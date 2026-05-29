import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

// Public site URL. Used for canonical links, sitemap and RSS absolute URLs.
// `||` (not `??`) so an *empty* DEVLOG_SITE_URL — which GitHub Actions sets when
// the repo variable is unset — falls back to the default instead of being an
// invalid "" URL.
const site = process.env.DEVLOG_SITE_URL || "https://devlog.lilink.top";

export default defineConfig({
  site,
  trailingSlash: "never",
  integrations: [
    mdx(),
    // /entries/* are fetch-only HTML fragments (also disallowed in robots.txt).
    sitemap({ filter: (page) => !page.includes("/entries/") }),
  ],
  build: {
    format: "directory",
  },
});
