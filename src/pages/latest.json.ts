import type { APIRoute } from "astro";
import { UPDATES_JSON_HEADERS, buildLatestProbe } from "../lib/updates-feed";

/** Lightweight probe for the LiLink nav NEW badge: latest publish date + post count. */
export const GET: APIRoute = async () => {
  const probe = await buildLatestProbe();

  return new Response(JSON.stringify(probe), { headers: UPDATES_JSON_HEADERS });
};
