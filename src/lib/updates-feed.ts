import { toIsoDate } from "./dates";
import { resolveTags } from "./tags";
import { getPublishedPosts, postPath, type Post } from "./posts";

/** Max items in /updates.json; older posts remain on the devlog site. */
export const UPDATES_FEED_LIMIT = 50;

export interface UpdateItem {
  title: string;
  summary: string;
  publishedAt: string;
  updatedAt: string | null;
  url: string;
  tags: string[];
  cover: string | null;
  featured: boolean;
}

export interface UpdatesFeedPayload {
  generatedAt: string;
  latestPublishedAt: string | null;
  totalPublished: number;
  items: UpdateItem[];
}

function toUpdateItem(post: Post, site: URL): UpdateItem {
  return {
    title: post.data.title,
    summary: post.data.summary,
    publishedAt: toIsoDate(post.data.publishedAt),
    updatedAt: post.data.updatedAt ? toIsoDate(post.data.updatedAt) : null,
    url: new URL(postPath(post), site).href,
    tags: resolveTags(post.data.tags).map((t) => t.name),
    cover: post.data.cover ? new URL(post.data.cover.src, site).href : null,
    featured: post.data.featured,
  };
}

export async function buildUpdatesFeed(site: URL): Promise<UpdatesFeedPayload> {
  const posts = await getPublishedPosts();
  const latestPublishedAt = posts[0]
    ? toIsoDate(posts[0].data.publishedAt)
    : null;

  return {
    generatedAt: new Date().toISOString(),
    latestPublishedAt,
    totalPublished: posts.length,
    items: posts.slice(0, UPDATES_FEED_LIMIT).map((post) => toUpdateItem(post, site)),
  };
}

export async function getLatestPublishedAt(): Promise<string | null> {
  const posts = await getPublishedPosts();
  return posts[0] ? toIsoDate(posts[0].data.publishedAt) : null;
}

export const UPDATES_JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=600, s-maxage=600",
} as const;
