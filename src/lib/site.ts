/**
 * Fallback site origin for API routes when Astro's `context.site` is unset.
 * In this project `site` is always configured in astro.config.mjs, so this only
 * guards edge cases (e.g. tests / a misconfigured env). Keep in sync with the
 * `site` default in astro.config.mjs.
 */
export const DEFAULT_SITE_URL = "https://devlog.lilink.top";
