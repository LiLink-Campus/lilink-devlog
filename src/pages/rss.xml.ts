import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPublishedPosts } from "../lib/posts";

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  const site = context.site ?? new URL("https://devlog.lilink.top");

  return rss({
    title: "LiLink devlog",
    description: "LiLink 产品迭代日志：我们解决了哪些问题，体验有了什么变化。",
    site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      pubDate: post.data.publishedAt,
      link: `/posts/${post.id}`,
    })),
    customData: "<language>zh-CN</language>",
  });
}
