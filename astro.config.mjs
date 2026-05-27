import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

// Public site URL. Used for canonical links, sitemap and RSS absolute URLs.
const site = process.env.DEVLOG_SITE_URL ?? "https://devlog.lilink.top";

export default defineConfig({
  site,
  trailingSlash: "never",
  integrations: [mdx(), sitemap()],
  build: {
    format: "directory",
  },
});
