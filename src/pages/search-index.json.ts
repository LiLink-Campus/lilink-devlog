// Build-time search index endpoint -> emits /search-index.json (static JSON).
//
// One record per PUBLISHED post (getPublishedPosts is published-only in PROD,
// so drafts/review posts are never indexed). The client search page fetches
// this once and runs `fuzzySearch` over it.

import { resolveAuthors } from "../lib/authors";
import { formatPublishedDate, toIsoDate } from "../lib/dates";
import { getPublishedPosts } from "../lib/posts";
import { mdxToPlainText, type SearchDoc } from "../lib/search";
import { resolveTags } from "../lib/tags";

// Cap indexed body text so the JSON stays small; full posts are short here.
const TEXT_CAP = 2000;

export async function GET() {
  const posts = await getPublishedPosts();

  const index: SearchDoc[] = posts.map((post) => {
    const { title, summary, publishedAt, tags, authors } = post.data;
    return {
      id: post.id,
      url: `/posts/${post.id}`,
      title,
      summary,
      date: toIsoDate(publishedAt),
      dateLabel: formatPublishedDate(publishedAt),
      tags: resolveTags(tags).map((t) => t.label),
      tagIds: [...tags],
      authors: resolveAuthors(authors).map((a) => a.name),
      text: mdxToPlainText(post.body ?? "").slice(0, TEXT_CAP),
    };
  });

  return new Response(JSON.stringify(index), {
    headers: { "content-type": "application/json" },
  });
}
