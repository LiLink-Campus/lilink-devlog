import type { APIRoute } from "astro";
import { toIsoDate } from "../lib/dates";
import { resolveTags } from "../lib/tags";
import { getPublishedPosts, postPath } from "../lib/posts";

/** One update record per published devlog post, consumed by the LiLink web app. */
interface UpdateItem {
  title: string;
  summary: string;
  publishedAt: string; // ISO date (YYYY-MM-DD)
  updatedAt: string | null;
  url: string; // absolute devlog URL
  tags: string[];
  cover: string | null; // absolute URL or null
  featured: boolean;
}

interface UpdatesFeed {
  generatedAt: string;
  items: UpdateItem[];
}

export const GET: APIRoute = async (context) => {
  const site = context.site ?? new URL("https://devlog.lilink.top");
  const posts = await getPublishedPosts(); // newest-first, published-only

  const items: UpdateItem[] = posts.map((post) => ({
    title: post.data.title,
    summary: post.data.summary,
    publishedAt: toIsoDate(post.data.publishedAt),
    updatedAt: post.data.updatedAt ? toIsoDate(post.data.updatedAt) : null,
    url: new URL(postPath(post), site).href,
    tags: resolveTags(post.data.tags).map((t) => t.name),
    cover: post.data.cover ? new URL(post.data.cover.src, site).href : null,
    featured: post.data.featured,
  }));

  const feed: UpdatesFeed = {
    generatedAt: new Date().toISOString(),
    items,
  };

  return new Response(JSON.stringify(feed), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Public feed; allow any origin so a browser could also read it directly.
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=600, s-maxage=600",
    },
  });
};
