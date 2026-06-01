import type { APIRoute } from "astro";
import {
  UPDATES_JSON_HEADERS,
  buildUpdatesFeed,
} from "../lib/updates-feed";

export const GET: APIRoute = async (context) => {
  const site = context.site ?? new URL("https://devlog.lilink.top");
  const feed = await buildUpdatesFeed(site);

  return new Response(JSON.stringify(feed), {
    headers: UPDATES_JSON_HEADERS,
  });
};
