import type { APIRoute } from "astro";
import {
  UPDATES_JSON_HEADERS,
  getLatestPublishedAt,
} from "../lib/updates-feed";

/** Lightweight probe for the LiLink nav NEW badge (latest publish date only). */
export const GET: APIRoute = async () => {
  const latestPublishedAt = await getLatestPublishedAt();

  return new Response(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      latestPublishedAt,
    }),
    { headers: UPDATES_JSON_HEADERS },
  );
};
