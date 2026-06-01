import type { APIRoute } from "astro";
import {
  UPDATES_JSON_HEADERS,
  buildUpdatesFeed,
} from "../lib/updates-feed";
import { DEFAULT_SITE_URL } from "../lib/site";

export const GET: APIRoute = async (context) => {
  const site = context.site ?? new URL(DEFAULT_SITE_URL);
  const feed = await buildUpdatesFeed(site);

  return new Response(JSON.stringify(feed), {
    headers: UPDATES_JSON_HEADERS,
  });
};
