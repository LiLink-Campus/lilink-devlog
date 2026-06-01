import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPublishedPosts, postPath } from "../lib/posts";
import { resolveTags } from "../lib/tags";
import { DEFAULT_SITE_URL } from "../lib/site";

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  const site = context.site ?? new URL(DEFAULT_SITE_URL);

  return rss({
    title: "LiLink devlog",
    description: "LiLink 产品迭代日志：我们解决了哪些问题，体验有了什么变化。",
    site,
    // @astrojs/rss adds a trailing slash by default; keep links bare to match
    // the canonical and sitemap URLs (both slash-less under trailingSlash: never).
    trailingSlash: false,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      pubDate: post.data.publishedAt,
      link: postPath(post),
      categories: resolveTags(post.data.tags).map((t) => t.name),
    })),
    customData: "<language>zh-CN</language>",
  });
}
