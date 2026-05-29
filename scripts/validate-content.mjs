// Content validation for the LiLink devlog.
//
//   node scripts/validate-content.mjs              # validate the source content
//   node scripts/validate-content.mjs --check-build # production-safety gate on dist/
//
// Source mode reads src/content/posts/*.mdx (skipping files starting with `_`),
// plus the authors/tags registries, and checks every post against the agreed
// editorial schema WITHOUT importing astro:content — a tiny hand-rolled
// frontmatter parser keeps this runnable as plain Node ESM with no deps.
//
// Build mode (`--check-build`) inspects an already-built dist/ and asserts no
// draft/review post leaked into the static output or the search index.
//
// All problems are collected and printed grouped per file; exit code is 1 if
// any error was found, 0 if everything is clean.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const postsDir = path.join(repoRoot, "src/content/posts");
const authorsJsonPath = path.join(repoRoot, "src/content/authors.json");
const tagsJsonPath = path.join(repoRoot, "src/content/tags.json");
const distDir = path.join(repoRoot, "dist");

const STATUS_VALUES = ["draft", "review", "published"];
const NON_PUBLIC_STATUSES = new Set(["draft", "review"]);
const SUMMARY_MAX = 120;
const TAGS_MAX = 4;
const FILENAME_RE = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.mdx$/;
// Shared id / slug shape: lowercase letters, digits, single hyphens.
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── reporting ─────────────────────────────────────────────────────────────
// Problems are bucketed by a label (a filename, or a synthetic group like the
// registry name) so the final report reads file-by-file.
const problems = new Map(); // label -> { errors: string[], warnings: string[] }

function bucket(label) {
  let b = problems.get(label);
  if (!b) {
    b = { errors: [], warnings: [] };
    problems.set(label, b);
  }
  return b;
}
function err(label, msg) {
  bucket(label).errors.push(msg);
}
function warn(label, msg) {
  bucket(label).warnings.push(msg);
}

// ── tiny frontmatter parser ─────────────────────────────────────────────────
// Good enough for our flat frontmatter: scalars (quoted or bare), inline arrays
// (["a", "b"]) and booleans. Lines whose key part starts with `#` are comments;
// trailing ` # ...` comments on a value line are stripped. Returns null when no
// frontmatter block is present.
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const body = m[1];
  const data = {};
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key || key.startsWith("#")) continue;
    let value = line.slice(idx + 1).trim();
    value = stripTrailingComment(value);
    data[key] = parseValue(value);
  }
  return data;
}

// Drop an unquoted trailing `# comment`, leaving `#` inside quotes alone.
function stripTrailingComment(value) {
  if (!value) return value;
  const quote = value[0] === '"' || value[0] === "'" ? value[0] : null;
  if (quote) {
    // Find the matching closing quote, then trim anything after it.
    for (let i = 1; i < value.length; i++) {
      if (value[i] === quote) return value.slice(0, i + 1).trim();
    }
    return value; // unterminated quote — leave as-is, validation will catch shape issues
  }
  const hashAt = value.indexOf(" #");
  if (hashAt !== -1) return value.slice(0, hashAt).trim();
  return value.trim();
}

function unquote(s) {
  const t = s.trim();
  if (t.length >= 2 && (t[0] === '"' || t[0] === "'") && t[t.length - 1] === t[0]) {
    return t.slice(1, -1);
  }
  return t;
}

function parseValue(value) {
  if (value === "") return "";
  // Inline array: [a, b] or ["a", "b"].
  if (value[0] === "[" && value[value.length - 1] === "]") {
    const inner = value.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((part) => unquote(part)).filter((s) => s !== "");
  }
  if (value === "true") return true;
  if (value === "false") return false;
  return unquote(value);
}

// ── registry loading ─────────────────────────────────────────────────────────
function loadRegistry(jsonPath, label) {
  if (!fs.existsSync(jsonPath)) {
    err(label, `找不到注册表文件：${rel(jsonPath)}`);
    return {};
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      err(label, `${rel(jsonPath)} 顶层应为对象（按 id 索引）。`);
      return {};
    }
    return parsed;
  } catch (e) {
    err(label, `${rel(jsonPath)} 不是合法 JSON：${e.message}`);
    return {};
  }
}

function rel(p) {
  return path.relative(repoRoot, p) || p;
}

// ── source-content validation ───────────────────────────────────────────────
function validateSource() {
  bucket("src/content/authors.json");
  bucket("src/content/tags.json");
  const authors = loadRegistry(authorsJsonPath, "src/content/authors.json");
  const tags = loadRegistry(tagsJsonPath, "src/content/tags.json");
  validateRegistryShape(authors, "src/content/authors.json");
  validateRegistryShape(tags, "src/content/tags.json");
  const authorIds = new Set(Object.keys(authors));
  const tagIds = new Set(Object.keys(tags));

  if (!fs.existsSync(postsDir)) {
    err("src/content/posts", `找不到文章目录：${rel(postsDir)}`);
    return;
  }

  const files = fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
    .sort();

  if (files.length === 0) {
    warn("src/content/posts", "没有发现任何待校验的 .mdx 文章。");
  }

  const slugOwners = new Map(); // effective slug -> [fileId, ...]
  for (const file of files) {
    bucket(`src/content/posts/${file}`); // list every post in the report, even when clean
    const info = validatePost(file, { authorIds, tagIds });
    if (info) {
      const owners = slugOwners.get(info.effectiveSlug) ?? [];
      owners.push(info.fileId);
      slugOwners.set(info.effectiveSlug, owners);
    }
  }

  // Two posts must never resolve to the same /posts/<slug> URL.
  for (const [slug, owners] of slugOwners) {
    if (owners.length > 1) {
      for (const fileId of owners) {
        err(
          `src/content/posts/${fileId}.mdx`,
          `slug「${slug}」冲突——这些文章都解析到 /posts/${slug}：${owners.join(", ")}。给其中之一改用不同的 frontmatter slug。`,
        );
      }
    }
  }
}

// Each registry record must be keyed by its own id, and ids must be kebab-case.
function validateRegistryShape(registry, label) {
  for (const [key, record] of Object.entries(registry)) {
    if (!ID_RE.test(key)) {
      err(label, `id「${key}」格式不对——只能是小写字母、数字、连字符。`);
    }
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      err(label, `「${key}」的值应为对象。`);
      continue;
    }
    if (record.id !== key) {
      err(
        label,
        `「${key}」的内部 id 字段（${record.id ?? "缺失"}）必须与 key 一致，否则生成的链接会对不上。`,
      );
    }
  }
}

function validatePost(file, { authorIds, tagIds }) {
  const label = `src/content/posts/${file}`;
  const fullPath = path.join(postsDir, file);
  const raw = fs.readFileSync(fullPath, "utf8");

  // ── filename shape + date ──
  const nameMatch = file.match(FILENAME_RE);
  if (!nameMatch) {
    err(
      label,
      "文件名必须形如 YYYY-MM-DD-<小写短横线 slug>.mdx（slug 只能是小写字母、数字、连字符）。",
    );
  }
  const filenameDate = nameMatch ? nameMatch[1] : null;

  const data = parseFrontmatter(raw);
  if (!data) {
    err(label, "缺少 frontmatter（文件开头的 --- … --- 区块）。");
    return null;
  }

  // ── required fields ──
  for (const key of ["title", "publishedAt", "summary", "status"]) {
    if (data[key] === undefined || data[key] === "") {
      err(label, `缺少必填字段 ${key}。`);
    }
  }

  // ── title ──
  if (data.title !== undefined && typeof data.title !== "string") {
    err(label, "title 必须是字符串。");
  }

  // ── status ──
  let status = data.status;
  if (status !== undefined && !STATUS_VALUES.includes(status)) {
    err(label, `status「${status}」无效，必须是 ${STATUS_VALUES.join(" / ")} 之一。`);
  }

  // ── summary length ──
  if (typeof data.summary === "string") {
    const len = [...data.summary].length; // count by code points, not UTF-16 units
    if (len > SUMMARY_MAX) {
      err(label, `summary 长度为 ${len}，超过上限 ${SUMMARY_MAX}。`);
    }
  } else if (data.summary !== undefined) {
    err(label, "summary 必须是字符串。");
  }

  // ── publishedAt + filename date agreement ──
  const publishedAt = normalizeDate(data.publishedAt);
  if (data.publishedAt !== undefined && data.publishedAt !== "" && !publishedAt) {
    err(label, `publishedAt「${data.publishedAt}」不是合法日期（应为 YYYY-MM-DD）。`);
  }
  if (filenameDate && publishedAt && filenameDate !== publishedAt) {
    err(
      label,
      `文件名日期（${filenameDate}）与 publishedAt（${publishedAt}）不一致。`,
    );
  }

  // ── updatedAt (optional) ──
  if (data.updatedAt !== undefined && data.updatedAt !== "") {
    if (!normalizeDate(data.updatedAt)) {
      err(label, `updatedAt「${data.updatedAt}」不是合法日期（应为 YYYY-MM-DD）。`);
    }
  }

  // ── slug override (optional) — becomes the /posts/<slug> path segment ──
  if (data.slug !== undefined && data.slug !== "") {
    if (typeof data.slug !== "string" || !ID_RE.test(data.slug)) {
      err(label, `slug「${data.slug}」格式不对——只能是小写字母、数字、连字符（会作为 /posts/<slug> 链接路径）。`);
    }
  }

  // ── authors ──
  const authorsVal = data.authors;
  if (authorsVal !== undefined) {
    if (!Array.isArray(authorsVal)) {
      err(label, "authors 必须是数组（作者 id 列表，如 [\"lilink-team\"]）。");
    } else {
      for (const id of authorsVal) {
        if (!authorIds.has(id)) {
          err(
            label,
            `未知作者 id「${id}」——请先在 src/content/authors.json 注册。已知：${[...authorIds].join(", ")}`,
          );
        }
      }
    }
  }
  // (authors is optional in the schema — defaults to ["lilink-team"] — so absence is fine.)

  // ── tags ──
  const tagsVal = data.tags;
  if (tagsVal !== undefined) {
    if (!Array.isArray(tagsVal)) {
      err(label, "tags 必须是数组（标签 id 列表）。");
    } else {
      if (tagsVal.length > TAGS_MAX) {
        err(label, `标签数量为 ${tagsVal.length}，最多只能有 ${TAGS_MAX} 个。`);
      }
      for (const id of tagsVal) {
        if (!tagIds.has(id)) {
          err(
            label,
            `未知标签 id「${id}」——请先在 src/content/tags.json 注册。已知：${[...tagIds].join(", ")}`,
          );
        }
      }
    }
  }

  // ── cover + coverAlt ──
  if (data.cover !== undefined && data.cover !== "") {
    if (typeof data.cover !== "string") {
      err(label, "cover 必须是指向图片的路径字符串。");
    } else {
      const coverPath = resolveRelative(fullPath, data.cover);
      if (coverPath && !fs.existsSync(coverPath)) {
        err(label, `cover 指向的文件不存在：${data.cover}（解析为 ${rel(coverPath)}）。`);
      }
    }
    if (data.coverAlt === undefined || data.coverAlt === "") {
      err(label, "设置了 cover 就必须同时提供 coverAlt（封面的替代文字）。");
    }
  }

  // ── body checks (images exist on disk; all media has alt) ──
  validateBody(label, fullPath, raw);

  // Effective URL slug, for cross-post uniqueness in validateSource.
  const fileId = file.replace(/\.mdx$/, "");
  const effectiveSlug =
    typeof data.slug === "string" && data.slug !== "" ? data.slug : fileId;
  return { fileId, effectiveSlug };
}

// Split frontmatter off, then scan the body for media problems.
function validateBody(label, fullPath, raw) {
  const fmMatch = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  const body = fmMatch ? raw.slice(fmMatch[0].length) : raw;

  // Markdown images: ![alt](src "title")
  const mdImg = /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
  let m;
  while ((m = mdImg.exec(body)) !== null) {
    const alt = m[1].trim();
    const src = m[2].trim();
    if (alt === "") {
      err(label, `Markdown 图片缺少 alt 文字：![](${src})。`);
    }
    checkLocalImage(label, fullPath, src);
  }

  // <img …> / <Figure …> need a non-empty alt; <Video …> needs a non-empty
  // title. Component src/poster are plain URLs (must be public-rooted).
  const tagRe = /<(img|Figure|Video)\b([^>]*?)\/?>/gi;
  while ((m = tagRe.exec(body)) !== null) {
    const tag = m[1];
    const attrs = m[2];
    if (/^video$/i.test(tag)) {
      const title = attrValue(attrs, "title");
      if (title === null || title.trim() === "") {
        err(label, "<Video> 缺少非空 title。");
      }
      const vsrc = attrValue(attrs, "src");
      if (vsrc) checkLocalImage(label, fullPath, vsrc, true);
      const poster = attrValue(attrs, "poster");
      if (poster) checkLocalImage(label, fullPath, poster, true);
    } else {
      const alt = attrValue(attrs, "alt");
      if (alt === null || alt.trim() === "") {
        err(label, `<${tag}> 缺少非空 alt 文字。`);
      }
      const src = attrValue(attrs, "src");
      if (src) checkLocalImage(label, fullPath, src, true);
    }
  }

  // <Gallery items={[ {src, alt, caption}, … ]} /> — every item needs a
  // non-empty alt; local src must be a public-rooted path that exists.
  const galleryRe = /<Gallery\b([^>]*?)\/?>/gi;
  while ((m = galleryRe.exec(body)) !== null) {
    const itemsRaw = extractItemsArray(m[1]);
    if (itemsRaw === null) {
      warn(label, "<Gallery> 的 items 无法静态解析，跳过逐项校验——请确保每项都有非空 alt，且 src 为 public 根路径。");
      continue;
    }
    const objs = itemsRaw.match(/\{[^{}]*\}/g) ?? [];
    if (objs.length === 0) {
      warn(label, "<Gallery> 未解析到任何 item。");
    }
    for (const obj of objs) {
      const alt = jsObjValue(obj, "alt");
      if (alt === null || alt.trim() === "") {
        err(label, `<Gallery> 有一项缺少非空 alt：${obj.trim()}`);
      }
      const src = jsObjValue(obj, "src");
      if (src) checkLocalImage(label, fullPath, src, true);
    }
  }
}

// Pull the `items={[ … ]}` array text out of a <Gallery> attribute string.
function extractItemsArray(attrs) {
  const at = attrs.search(/items\s*=\s*\{/);
  if (at === -1) return null;
  const start = attrs.indexOf("[", at);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < attrs.length; i++) {
    if (attrs[i] === "[") depth++;
    else if (attrs[i] === "]" && --depth === 0) return attrs.slice(start, i + 1);
  }
  return null;
}

// Read a string value for `key` from a flat JS object-literal fragment.
function jsObjValue(objText, key) {
  const re = new RegExp(`\\b${key}\\s*:\\s*(?:"([^"]*)"|'([^']*)'|\`([^\`]*)\`)`);
  const mm = objText.match(re);
  if (!mm) return null;
  return mm[1] ?? mm[2] ?? mm[3] ?? "";
}

// Read a quoted (or {"..."} ) attribute value from a tag's attribute string.
// Returns null when the attribute is absent; "" when present but empty.
function attrValue(attrs, name) {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*["'\`]([^"'\`]*)["'\`]\\s*\\})`, "i");
  const m = attrs.match(re);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? "";
}

// Only verify on-disk existence for local refs (relative, or /-rooted into
// public/). Remote URLs and bare imported identifiers are left to Astro.
function checkLocalImage(label, fullPath, src, component = false) {
  if (!src) return;
  if (/^(?:https?:)?\/\//i.test(src) || src.startsWith("data:")) return; // remote / data URI
  if (src.startsWith("{") || /^[A-Za-z_$][\w$]*$/.test(src)) return; // JSX expression / imported var

  // Root-absolute → must exist under public/.
  if (src.startsWith("/")) {
    const resolved = path.join(repoRoot, "public", src.replace(/^\/+/, ""));
    if (!fs.existsSync(resolved)) {
      err(label, `引用的本地媒体不存在：${src}（解析为 ${rel(resolved)}）。`);
    }
    return;
  }

  // Relative path: fine for Markdown images (Astro processes them), but the
  // string-src components render a plain <img>/<video> that bypasses Astro's
  // asset pipeline, so a relative src would 404 in production.
  if (component) {
    err(
      label,
      `富媒体组件（Figure / Gallery / Video）的 src 不支持相对路径「${src}」——请放到 public/ 并用 /media/… 这样的根路径引用（或远程 URL）。`,
    );
    return;
  }
  const resolved = resolveRelative(fullPath, src);
  if (resolved && !fs.existsSync(resolved)) {
    err(label, `引用的本地图片不存在：${src}（解析为 ${rel(resolved)}）。`);
  }
}

function resolveRelative(fromFile, ref) {
  const clean = ref.replace(/^\.\//, "").split(/[?#]/)[0];
  return path.resolve(path.dirname(fromFile), clean);
}

// Normalise a frontmatter date value to a YYYY-MM-DD string, or null if it is
// not a valid calendar date. Accepts a bare date, a Date that JS already
// produced, or a full ISO timestamp (compared on its date part).
function normalizeDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject impossible days (e.g. 2026-02-30) via round-trip.
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${y}-${mo}-${d}`;
}

// ── build-output safety gate (--check-build) ────────────────────────────────
// Ensures no draft/review post leaked into the production build. Reads source
// frontmatter to learn each post's status (by id = filename minus .mdx), then
// asserts dist/posts/<id>/index.html is absent and the search index omits it.
function validateBuild() {
  const label = "dist (--check-build)";
  bucket(label); // always list the gate in the report, even when nothing is flagged

  if (!fs.existsSync(distDir)) {
    err(label, `找不到 dist/ 目录——请先运行 \`npm run build\` 再做构建校验。`);
    return;
  }
  if (!fs.existsSync(postsDir)) {
    err(label, `找不到文章源目录：${rel(postsDir)}。`);
    return;
  }

  const files = fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"));

  // Collect non-public posts (draft/review) — these must NOT ship. The built
  // page path follows postSlug(): the frontmatter `slug` override, else file id.
  const nonPublic = [];
  for (const file of files) {
    const data = parseFrontmatter(fs.readFileSync(path.join(postsDir, file), "utf8"));
    const status = data && data.status ? data.status : "published";
    if (NON_PUBLIC_STATUSES.has(status)) {
      const id = file.replace(/\.mdx$/, "");
      const slug = data && typeof data.slug === "string" && data.slug ? data.slug : id;
      nonPublic.push({ id, slug, status });
    }
  }

  // 1) No dist/posts/<slug>/index.html for any non-public post.
  for (const { id, slug, status } of nonPublic) {
    const page = path.join(distDir, "posts", slug, "index.html");
    if (fs.existsSync(page)) {
      err(
        label,
        `状态为 ${status} 的文章 ${id} 不应出现在构建产物里：发现了 ${rel(page)}。`,
      );
    }
  }

  // 2) search-index.json (if built) must contain none of those ids or URLs.
  const searchIndexPath = path.join(distDir, "search-index.json");
  if (fs.existsSync(searchIndexPath)) {
    let entries = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(searchIndexPath, "utf8"));
      entries = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      err(label, `dist/search-index.json 不是合法 JSON：${e.message}`);
    }
    const indexedIds = new Set(
      entries.map((e) => (e && typeof e === "object" ? e.id : undefined)).filter(Boolean),
    );
    const indexedUrls = new Set(
      entries.map((e) => (e && typeof e === "object" ? e.url : undefined)).filter(Boolean),
    );
    for (const { id, slug, status } of nonPublic) {
      if (indexedIds.has(id) || indexedUrls.has(`/posts/${slug}`)) {
        err(
          label,
          `状态为 ${status} 的文章 ${id} 不应出现在 dist/search-index.json 中。`,
        );
      }
    }
  } else {
    warn(label, "未找到 dist/search-index.json（若搜索功能已构建则应存在）。");
  }
}

// ── run ───────────────────────────────────────────────────────────────────
const checkBuild = process.argv.includes("--check-build");

if (checkBuild) {
  validateBuild();
} else {
  validateSource();
}

// ── report ──────────────────────────────────────────────────────────────────
let errorCount = 0;
let warningCount = 0;
const labels = [...problems.keys()].sort();

const mode = checkBuild ? "构建产物校验 (--check-build)" : "内容校验";
console.log(`\n${mode}\n${"─".repeat(40)}`);

for (const label of labels) {
  const { errors, warnings } = problems.get(label);
  errorCount += errors.length;
  warningCount += warnings.length;
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`\n  ✓ ${label}`);
    continue;
  }
  console.log(`\n  ${label}`);
  for (const e of errors) console.log(`    ✗ ${e}`);
  for (const w of warnings) console.log(`    ! ${w}`);
}

console.log(`\n${"─".repeat(40)}`);
if (errorCount === 0) {
  console.log(
    warningCount > 0
      ? `通过：0 个错误，${warningCount} 个提醒。`
      : `通过：所有检查均无问题。`,
  );
  process.exit(0);
} else {
  console.log(`失败：${errorCount} 个错误${warningCount > 0 ? `，${warningCount} 个提醒` : ""}。`);
  process.exit(1);
}
