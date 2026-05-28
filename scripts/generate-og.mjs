// Generates Open Graph share images:
//   public/og-default.png   — site-wide fallback (home page, etc.)
//   public/og/<slug>.png    — one per published post, showing its title
//
// WeChat and most social cards require a raster image, so we bake PNGs here
// and commit them; the deployed site only serves the static files (Vercel's
// build host has no CJK fonts). Rasterisation uses <text>, so it needs a CJK
// font (WenQuanYi Zen Hei) and a Latin serif (Liberation Serif) installed
// locally — run `npm run og:image` after adding or renaming a post.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "../public");
const postsDir = path.resolve(here, "../src/content/posts");
const ogDir = path.join(publicDir, "og");

const WIDTH = 1200;
const HEIGHT = 630;

// Brand tokens (see src/styles/tokens.css).
const CANVAS = "#fdf8f0";
const BRAND_TINT = "#fbe9ee";
const BRAND = "#8b3a4a";
const ACCENT = "#c8756a";
const INK = "#1a1210";
const INK_SOFT = "#6b5b50";
const INK_MUTED = "#9c8c80";
const ON_BRAND = "#fff7ee";

const LATIN_SERIF = "Liberation Serif, DejaVu Serif, serif";
const CJK = "WenQuanYi Zen Hei, sans-serif";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Shared backdrop (gradient + accent bar + soft circle), reused by every card.
function frame(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${CANVAS}" />
      <stop offset="1" stop-color="${BRAND_TINT}" />
    </linearGradient>
    <linearGradient id="glyph" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ACCENT}" />
      <stop offset="1" stop-color="${BRAND}" />
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
  <circle cx="1140" cy="560" r="280" fill="${BRAND}" opacity="0.06" />
  <rect x="0" y="0" width="${WIDTH}" height="10" fill="url(#glyph)" />
  ${inner}
</svg>`;
}

// Small corner logo (glyph + wordmark) for post cards.
function logoMark(x, y) {
  return `<rect x="${x}" y="${y}" width="84" height="84" rx="20" fill="url(#glyph)" />
  <circle cx="${x + 68}" cy="${y + 16}" r="5" fill="${ON_BRAND}" opacity="0.8" />
  <text x="${x + 42}" y="${y + 58}" font-family="${LATIN_SERIF}" font-size="42" font-weight="700" fill="${ON_BRAND}" text-anchor="middle">Li</text>
  <text x="${x + 104}" y="${y + 56}" font-family="${LATIN_SERIF}" font-size="38" font-weight="700" fill="${INK}">LiLink <tspan fill="${BRAND}" font-style="italic">devlog</tspan></text>`;
}

// Wrap a title into lines by column width (CJK / fullwidth counts as 2).
function wrapTitle(title, maxCols, maxLines) {
  const chars = [...String(title)];
  const lines = [];
  let line = "";
  let cols = 0;
  for (const ch of chars) {
    const w = /[⺀-鿿　-〿＀-￯]/.test(ch) ? 2 : 1;
    if (cols + w > maxCols && line) {
      lines.push(line);
      line = "";
      cols = 0;
    }
    line += ch;
    cols += w;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = [...lines[maxLines - 1]].slice(0, -1).join("") + "…";
  }
  // Avoid a lone trailing character: borrow one from the previous line.
  if (lines.length >= 2 && [...lines[lines.length - 1]].length === 1) {
    const prev = [...lines[lines.length - 2]];
    const moved = prev.pop();
    lines[lines.length - 2] = prev.join("");
    lines[lines.length - 1] = moved + lines[lines.length - 1];
  }
  return lines;
}

function defaultCard() {
  return frame(`
  <rect x="96" y="232" width="132" height="132" rx="30" fill="url(#glyph)" />
  <circle cx="206" cy="256" r="7" fill="${ON_BRAND}" opacity="0.8" />
  <text x="162" y="322" font-family="${LATIN_SERIF}" font-size="64" font-weight="700" fill="${ON_BRAND}" text-anchor="middle">Li</text>
  <text x="262" y="312" font-family="${LATIN_SERIF}" font-size="74" font-weight="700" fill="${INK}">LiLink <tspan fill="${BRAND}" font-style="italic">devlog</tspan></text>
  <text x="266" y="372" font-family="${CJK}" font-size="32" fill="${INK_SOFT}">持续迭代，认真相遇</text>
  <text x="96" y="566" font-family="${LATIN_SERIF}" font-size="26" letter-spacing="1" fill="${INK_MUTED}">devlog.lilink.top</text>`);
}

function postCard({ title, dateLabel }) {
  const lines = wrapTitle(title, 24, 3);
  const fontSize = 68;
  const lineGap = 92;
  const startY = 352 - ((lines.length - 1) * lineGap) / 2;
  const titleSvg = lines
    .map(
      (ln, i) =>
        `<text x="96" y="${startY + i * lineGap}" font-family="${CJK}" font-size="${fontSize}" font-weight="700" fill="${INK}">${esc(ln)}</text>`,
    )
    .join("\n  ");
  const meta = dateLabel
    ? `<text x="96" y="566" font-family="${CJK}" font-size="28" fill="${INK_SOFT}">${esc(dateLabel)}<tspan dx="20" font-family="${LATIN_SERIF}" fill="${INK_MUTED}">· devlog.lilink.top</tspan></text>`
    : `<text x="96" y="566" font-family="${LATIN_SERIF}" font-size="26" letter-spacing="1" fill="${INK_MUTED}">devlog.lilink.top</text>`;
  return frame(`
  ${logoMark(96, 86)}
  ${titleSvg}
  ${meta}`);
}

async function render(svg, outFile) {
  await sharp(Buffer.from(svg), { density: 192 })
    .resize(WIDTH, HEIGHT)
    .png()
    .toFile(outFile);
  console.log(`Wrote ${path.relative(process.cwd(), outFile)}`);
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = m[1];
  const field = (key) => {
    const r = fm.match(new RegExp(`^${key}:[ \\t]*(.+?)[ \\t]*$`, "m"));
    return r ? r[1].trim() : undefined;
  };
  const title = (field("title") || "").replace(/^["']|["']$/g, "");
  return { title, publishedAt: field("publishedAt"), draft: field("draft") === "true" };
}

function cnDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return y && m && d ? `${y}年${m}月${d}日` : "";
}

// 1) Site-wide fallback card.
await render(defaultCard(), path.join(publicDir, "og-default.png"));

// 2) One card per published post.
await fs.mkdir(ogDir, { recursive: true });
const files = (await fs.readdir(postsDir)).filter(
  (f) => f.endsWith(".mdx") && !f.startsWith("_"),
);
let count = 0;
for (const file of files.sort()) {
  const data = parseFrontmatter(await fs.readFile(path.join(postsDir, file), "utf8"));
  if (!data || data.draft || !data.title) continue;
  const slug = file.replace(/\.mdx$/, "");
  await render(
    postCard({ title: data.title, dateLabel: cnDate(data.publishedAt) }),
    path.join(ogDir, `${slug}.png`),
  );
  count++;
}
console.log(`Done: 1 default + ${count} post cards.`);
