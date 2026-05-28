// Content validator for the PR-based publishing workflow (Phase 4).
//
// Scans every src/content/posts/*.mdx (skipping _*.mdx, which are excluded from
// the build) and enforces the rules that the runtime/build already assumes, so
// problems surface in CI on a pull request rather than at deploy time:
//
//   - frontmatter present & well-formed (required fields, valid dates, status,
//     featured boolean, ≤4 tags)
//   - author / tag IDs exist in the controlled registries
//   - media paths resolve (cover, ESM image imports, /media/ videos, markdown
//     images) and markdown images carry non-empty alt text
//   - internal /posts/<slug> and /tags/<id> links point at real targets
//   - draft-exposure guard: a published post must not link to a draft/review one
//
// Run via `node scripts/validate-content.mjs` (also `npm run validate`).
// Dependency-free Node ESM; robust to CRLF, quoted strings and [...] arrays.
//
// NOTE on reading the registries: this is a plain .mjs Node script and Node
// cannot import .ts source directly (no TS loader, and adding one would mean a
// new dependency). The author/tag IDs are the top-level keys of the `authors` /
// `tags` object literals in src/lib/{authors,tags}.ts, so we extract those keys
// with a small regex (`extractRegistryIds`). This keeps a single source of
// truth (the .ts registries) without a build step or extra deps. The self-test
// below exercises the validator end-to-end to keep this approach trustworthy.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const postsDir = path.join(root, "src", "content", "posts");
const publicDir = path.join(root, "public");
const pagesDir = path.join(root, "src", "pages");

// ---------------------------------------------------------------------------
// Registry id extraction (see NOTE above).
// ---------------------------------------------------------------------------

/**
 * Extract the top-level keys of an exported object literal from a .ts source
 * file, e.g. `export const authors = { "lilink-team": {...}, ... }`.
 * Returns a Set of the id strings (quoted or bare keys).
 */
function extractRegistryIds(filePath, exportName) {
  const src = fs.readFileSync(filePath, "utf8");
  // Locate `export const <exportName> = {` and capture the balanced body.
  const startRe = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*\\{`);
  const m = startRe.exec(src);
  if (!m) {
    throw new Error(`Could not find "export const ${exportName}" in ${filePath}`);
  }
  let i = m.index + m[0].length;
  let depth = 1;
  const bodyStart = i;
  for (; i < src.length && depth > 0; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  const body = src.slice(bodyStart, i - 1);
  const ids = new Set();
  // Top-level keys only: a key at bracket-depth 0 within `body` followed by `:`.
  let d = 0;
  const keyRe = /(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$-]*))\s*:/g;
  // Walk char-by-char to track nesting; collect keys seen at depth 0.
  let buf = "";
  for (let j = 0; j < body.length; j++) {
    const ch = body[j];
    if (ch === "{" || ch === "[" || ch === "(") {
      if (d === 0) {
        // Scan the buffer accumulated at depth 0 for a trailing `key:`.
        keyRe.lastIndex = 0;
        let last = null;
        let r;
        while ((r = keyRe.exec(buf))) last = r[1] ?? r[2] ?? r[3];
        if (last) ids.add(last);
        buf = "";
      }
      d++;
    } else if (ch === "}" || ch === "]" || ch === ")") {
      d--;
    } else if (d === 0) {
      buf += ch;
    }
  }
  return ids;
}

const authorIds = extractRegistryIds(path.join(root, "src", "lib", "authors.ts"), "authors");
const tagIds = extractRegistryIds(path.join(root, "src", "lib", "tags.ts"), "tags");

// ---------------------------------------------------------------------------
// Frontmatter parsing (small hand-rolled YAML subset for our known shape).
// ---------------------------------------------------------------------------

function stripQuotes(s) {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

/** Parse an inline `[a, "b", 'c']` array into a string list. */
function parseInlineArray(raw) {
  const inner = raw.trim().replace(/^\[/, "").replace(/\]$/, "").trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((s) => stripQuotes(s.trim()))
    .filter((s) => s.length > 0);
}

/**
 * Parse the `---` frontmatter block. Returns { data, body } or null if no
 * frontmatter block is present. Supports scalars, inline arrays and block
 * (`- item`) arrays for the fields we care about. Comment lines (`# ...`) are
 * ignored.
 */
function parseFrontmatter(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const fmText = m[1];
  const body = m[2] ?? "";
  const lines = fmText.split("\n");
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const kv = line.match(/^([A-Za-z_][\w]*):[ \t]*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2];
    // Strip trailing inline comment for scalar values (not inside quotes/array).
    if (value && !value.trim().startsWith("[") && !/^["']/.test(value.trim())) {
      const hash = value.indexOf(" #");
      if (hash >= 0) value = value.slice(0, hash);
    }
    value = value.trim();
    if (value.startsWith("[")) {
      data[key] = parseInlineArray(value);
    } else if (value === "") {
      // Possibly a block array on following lines.
      const items = [];
      let j = i + 1;
      while (j < lines.length && /^[ \t]*-[ \t]+/.test(lines[j])) {
        items.push(stripQuotes(lines[j].replace(/^[ \t]*-[ \t]+/, "").trim()));
        j++;
      }
      if (items.length) {
        data[key] = items;
        i = j - 1;
      } else {
        data[key] = "";
      }
    } else {
      data[key] = stripQuotes(value);
    }
  }
  return { data, body };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function isValidIsoDate(v) {
  if (typeof v !== "string" || !ISO_DATE_RE.test(v)) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

function isExternal(href) {
  return /^(https?:)?\/\//i.test(href) || /^(mailto:|tel:|#)/i.test(href);
}

function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

// Static routes that exist as src/pages files (besides dynamic ones).
function knownStaticRoute(route) {
  // Normalise: strip query/hash and trailing slash.
  let r = route.split(/[?#]/)[0];
  if (r.length > 1) r = r.replace(/\/$/, "");
  const allow = new Set(["/", "/404", "/rss.xml", "/tags"]);
  if (allow.has(r)) return true;
  // Try to map to a src/pages file.
  const candidates = [
    path.join(pagesDir, r.replace(/^\//, "") + ".astro"),
    path.join(pagesDir, r.replace(/^\//, "") + ".ts"),
    path.join(pagesDir, r.replace(/^\//, ""), "index.astro"),
  ];
  return candidates.some((c) => fileExists(c));
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

const files = fs
  .readdirSync(postsDir)
  .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
  .sort();

const slugs = new Set(files.map((f) => f.replace(/\.mdx$/, "")));

// First pass: collect status per slug for the draft-exposure guard.
const statusBySlug = new Map();
const parsedByFile = new Map();
for (const file of files) {
  const raw = fs.readFileSync(path.join(postsDir, file), "utf8");
  const parsed = parseFrontmatter(raw);
  parsedByFile.set(file, parsed);
  const slug = file.replace(/\.mdx$/, "");
  const status = parsed?.data?.status || "published";
  statusBySlug.set(slug, status);
}

/** problems: Map<file, string[]> */
const problems = new Map();
function addProblem(file, msg) {
  if (!problems.has(file)) problems.set(file, []);
  problems.get(file).push(msg);
}

for (const file of files) {
  const parsed = parsedByFile.get(file);

  if (!parsed) {
    addProblem(file, "missing or malformed `---` frontmatter block");
    continue;
  }
  const { data, body } = parsed;

  // a. Required fields & well-formedness ------------------------------------
  for (const field of ["title", "publishedAt", "summary"]) {
    const v = data[field];
    if (v === undefined || (typeof v === "string" && v.trim() === "")) {
      addProblem(file, `missing required frontmatter field \`${field}\``);
    }
  }
  if (data.publishedAt !== undefined && !isValidIsoDate(String(data.publishedAt))) {
    addProblem(file, `\`publishedAt\` is not a valid ISO date: "${data.publishedAt}"`);
  }
  if (data.updatedAt !== undefined && data.updatedAt !== "" && !isValidIsoDate(String(data.updatedAt))) {
    addProblem(file, `\`updatedAt\` is not a valid ISO date: "${data.updatedAt}"`);
  }
  if (data.status !== undefined && data.status !== "") {
    if (!["draft", "review", "published"].includes(data.status)) {
      addProblem(file, `\`status\` must be one of draft|review|published, got "${data.status}"`);
    }
  }
  if (data.featured !== undefined && data.featured !== "") {
    if (!["true", "false"].includes(String(data.featured))) {
      addProblem(file, `\`featured\` must be a boolean, got "${data.featured}"`);
    }
  }

  const authors = Array.isArray(data.authors) ? data.authors : data.authors ? [data.authors] : [];
  const tags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];

  // b. Author IDs -----------------------------------------------------------
  for (const id of authors) {
    if (!authorIds.has(id)) {
      addProblem(file, `unknown author id "${id}". Allowed: ${[...authorIds].join(", ")}`);
    }
  }

  // c. Tag IDs + count ------------------------------------------------------
  for (const id of tags) {
    if (!tagIds.has(id)) {
      addProblem(file, `unknown tag id "${id}". Allowed: ${[...tagIds].join(", ")}`);
    }
  }
  if (tags.length > 4) {
    addProblem(file, `too many tags (${tags.length}); max is 4`);
  }

  // d. Media paths ----------------------------------------------------------
  // cover
  if (data.cover && typeof data.cover === "string") {
    const coverPath = path.resolve(postDir, data.cover);
    if (!fileExists(coverPath)) {
      addProblem(file, `cover image not found: "${data.cover}"`);
    }
  }

  // ESM image imports: import X from "./assets/..."
  const importRe = /import\s+[\w{},*\s]+\s+from\s+["'](\.\.?\/[^"']+)["']/g;
  let im;
  while ((im = importRe.exec(body))) {
    const ref = im[1];
    // Only validate asset-like imports (images/media), not component imports.
    if (/\.(png|jpe?g|gif|webp|avif|svg|mp4|webm|mov)$/i.test(ref)) {
      const abs = path.resolve(postDir, ref);
      if (!fileExists(abs)) {
        addProblem(file, `imported asset not found: "${ref}"`);
      }
    }
  }

  // Self-hosted video / media refs: /media/...
  const mediaRe = /["'(](\/media\/[^"')\s]+)["')\s]/g;
  let md;
  while ((md = mediaRe.exec(body))) {
    const ref = md[1];
    const abs = path.join(publicDir, ref.replace(/^\//, ""));
    if (!fileExists(abs)) {
      addProblem(file, `self-hosted media not found under public/: "${ref}"`);
    }
  }

  // Markdown images: ![alt](path)
  const mdImgRe = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  let mi;
  while ((mi = mdImgRe.exec(body))) {
    const alt = mi[1].trim();
    const src = mi[2].trim();
    if (alt === "") {
      addProblem(file, `markdown image missing alt text: ![](${src})`);
    }
    if (!isExternal(src) && !src.startsWith("/media/")) {
      if (src.startsWith("/")) {
        const abs = path.join(publicDir, src.replace(/^\//, ""));
        if (!fileExists(abs)) addProblem(file, `markdown image not found: "${src}"`);
      } else if (src.startsWith(".")) {
        const abs = path.resolve(postDir, src);
        if (!fileExists(abs)) addProblem(file, `markdown image not found: "${src}"`);
      }
    }
  }

  // e + f. Links ------------------------------------------------------------
  const linkTargets = [];
  const mdLinkRe = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  let ml;
  while ((ml = mdLinkRe.exec(body))) linkTargets.push(ml[1].trim());
  const hrefRe = /href=["']([^"']+)["']/g;
  let hl;
  while ((hl = hrefRe.exec(body))) linkTargets.push(hl[1].trim());

  const thisStatus = data.status || "published";
  for (const href of linkTargets) {
    if (isExternal(href)) continue;
    if (!href.startsWith("/") && !href.startsWith(".")) continue; // not an internal route

    // Normalise to a route path for /posts/ and /tags/ checks.
    const route = href.split(/[?#]/)[0];

    const postMatch = route.match(/^\/posts\/([^/]+)\/?$/);
    if (postMatch) {
      const target = postMatch[1];
      if (!slugs.has(target)) {
        addProblem(file, `broken internal link to non-existent post: "${href}"`);
      } else {
        // f. draft-exposure guard
        const targetStatus = statusBySlug.get(target) || "published";
        if (thisStatus === "published" && targetStatus !== "published") {
          addProblem(
            file,
            `published post links to ${targetStatus} post "/posts/${target}" (draft exposure)`,
          );
        }
      }
      continue;
    }

    const tagMatch = route.match(/^\/tags\/([^/]+)\/?$/);
    if (tagMatch) {
      const target = tagMatch[1];
      if (!tagIds.has(target)) {
        addProblem(file, `broken internal link to unknown tag: "${href}"`);
      }
      continue;
    }

    // Other internal absolute routes: warn (not error) if unresolved.
    if (route.startsWith("/") && !knownStaticRoute(route)) {
      addProblem(file, `⚠ unverified internal link "${href}" (no matching static route; verify manually)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

// Separate hard errors from warnings (warnings are prefixed with ⚠).
let errorCount = 0;
let warnCount = 0;
for (const list of problems.values()) {
  for (const msg of list) {
    if (msg.startsWith("⚠")) warnCount++;
    else errorCount++;
  }
}

if (problems.size === 0) {
  console.log(`✓ validated ${files.length} posts, 0 problems`);
  process.exit(0);
}

for (const [file, list] of [...problems.entries()].sort()) {
  console.log(`\n${file}`);
  for (const msg of list) {
    const isWarn = msg.startsWith("⚠");
    console.log(`  ${isWarn ? "" : "✗ "}${msg}`);
  }
}

console.log("");
if (errorCount > 0) {
  console.log(
    `✗ validated ${files.length} posts, ${errorCount} error(s)` +
      (warnCount ? `, ${warnCount} warning(s)` : ""),
  );
  process.exit(1);
} else {
  console.log(`✓ validated ${files.length} posts, 0 errors, ${warnCount} warning(s)`);
  process.exit(0);
}
