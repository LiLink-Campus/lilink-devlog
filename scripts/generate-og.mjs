// Generates the default Open Graph share image (public/og-default.png).
//
// WeChat and most social cards require a raster image, so we bake a 1200x630
// PNG here and commit it; the deployed site only serves the static file.
// Rasterization uses <text>, so it needs a CJK font (e.g. WenQuanYi Zen Hei)
// and a Latin serif (e.g. Liberation Serif) installed in the build host.
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(here, "../public/og-default.png");

const WIDTH = 1200;
const HEIGHT = 630;

// Brand tokens (see apps/web/src/styles/tokens.css).
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

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
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

  <rect x="96" y="232" width="132" height="132" rx="30" fill="url(#glyph)" />
  <circle cx="206" cy="256" r="7" fill="${ON_BRAND}" opacity="0.8" />
  <text x="162" y="322" font-family="${LATIN_SERIF}" font-size="64" font-weight="700"
        fill="${ON_BRAND}" text-anchor="middle">Li</text>

  <text x="262" y="312" font-family="${LATIN_SERIF}" font-size="74" font-weight="700" fill="${INK}">LiLink <tspan fill="${BRAND}" font-style="italic">devlog</tspan></text>
  <text x="266" y="372" font-family="${CJK}" font-size="32" fill="${INK_SOFT}">持续迭代，认真相遇</text>

  <text x="96" y="566" font-family="${LATIN_SERIF}" font-size="26" letter-spacing="1"
        fill="${INK_MUTED}">devlog.lilink.top</text>
</svg>`;

await sharp(Buffer.from(svg), { density: 192 })
  .resize(WIDTH, HEIGHT)
  .png()
  .toFile(outFile);

console.log(`Wrote ${path.relative(process.cwd(), outFile)}`);
