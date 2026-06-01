/**
 * /updates.json（完整动态 feed）与 /latest.json（轻量探针）的数据构建。
 *
 * 两个 endpoint 供 LiLink 主站消费——首页「最新动态」模块与导航 NEW 角标。
 * 本站是 Astro static 输出，二者在【构建时】预渲染为静态 JSON：
 *   • generatedAt 是构建（部署）时刻，不是请求时刻；feed 内容随每次部署刷新，
 *     发布新文章需触发重新构建部署后才会更新。
 *   • 对外的 CORS / Cache-Control 由 vercel.json 的 headers 下发（Response 上设的
 *     header 在 static 下不生效）。
 * 主站判断「是否有新内容」：优先比较 latestPublishedAt；同一天发布多篇时该值不变，
 * 可再用 totalPublished 的变化兜底。
 */
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

/** /latest.json 探针：与完整 feed 同样的头部信息，但不含 items 列表。 */
export type LatestProbe = Omit<UpdatesFeedPayload, "items">;

/** 已按 newest-first 排序的列表中最新一篇的发布日期（YYYY-MM-DD）；空列表为 null。 */
function latestPublishedAtOf(posts: Post[]): string | null {
  return posts[0] ? toIsoDate(posts[0].data.publishedAt) : null;
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
  return {
    generatedAt: new Date().toISOString(),
    latestPublishedAt: latestPublishedAtOf(posts),
    totalPublished: posts.length,
    items: posts.slice(0, UPDATES_FEED_LIMIT).map((post) => toUpdateItem(post, site)),
  };
}

/** 轻量探针：仅发布前沿（最新日期 + 总数），不含 items，供主站 NEW 角标轮询。 */
export async function buildLatestProbe(): Promise<LatestProbe> {
  const posts = await getPublishedPosts();
  return {
    generatedAt: new Date().toISOString(),
    latestPublishedAt: latestPublishedAtOf(posts),
    totalPublished: posts.length,
  };
}

// 本站为 Astro static 输出：endpoint 在构建时被预渲染为静态 .json 文件，
// Response 上的 HTTP header 不会生效。对外真正的 CORS / Cache-Control 由
// vercel.json 的 `headers` 按 /updates.json、/latest.json 路径下发；content-type
// 由 Vercel 依扩展名自动设置。此常量保留作意图声明，并在某端点将来改为 SSR
// （export const prerender = false）时兜底。
export const UPDATES_JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=600, s-maxage=600",
} as const;
