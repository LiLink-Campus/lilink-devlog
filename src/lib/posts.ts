import { getCollection, type CollectionEntry } from "astro:content";
import { isoWeekKey, isoWeekParts, isoWeekRangeLabel } from "./dates";
import { getTag, type Tag } from "./tags";

export type Post = CollectionEntry<"posts">;

/** A post's URL slug — the optional frontmatter `slug` override, else its file id. */
export function postSlug(post: Post): string {
  return post.data.slug ?? post.id;
}

/** Canonical site path for a post, e.g. `/posts/2026-05-27-devlog-launch`. */
export function postPath(post: Post): string {
  return `/posts/${postSlug(post)}`;
}

/** Published posts, newest first. Non-published (draft/review) appear only in `astro dev`. */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection("posts", ({ data }) =>
    import.meta.env.PROD ? data.status === "published" : true,
  );
  return posts.sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );
}

export type WeekGroup = {
  key: string;
  isoYear: number;
  week: number;
  rangeLabel: string;
  posts: Post[];
};

/** Groups pre-sorted posts into ISO weeks, preserving newest-first order. */
export function groupByWeek(posts: Post[]): WeekGroup[] {
  const groups = new Map<string, WeekGroup>();
  for (const post of posts) {
    const date = post.data.publishedAt;
    const key = isoWeekKey(date);
    let group = groups.get(key);
    if (!group) {
      const { isoYear, week } = isoWeekParts(date);
      group = { key, isoYear, week, rangeLabel: isoWeekRangeLabel(date), posts: [] };
      groups.set(key, group);
    }
    group.posts.push(post);
  }
  return [...groups.values()];
}

/** Published posts carrying `tagId`, newest first. */
export async function getPostsByTag(tagId: string): Promise<Post[]> {
  const posts = await getPublishedPosts();
  return posts.filter((post) => (post.data.tags ?? []).includes(tagId));
}

/**
 * Every tag that appears on at least one published post, paired with its count.
 * Sorted by count (desc), then by display name for stability.
 */
export async function getAllTagsWithCounts(): Promise<{ tag: Tag; count: number }[]> {
  const posts = await getPublishedPosts();
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const id of post.data.tags ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const result: { tag: Tag; count: number }[] = [];
  for (const [id, count] of counts) {
    const tag = getTag(id);
    if (tag) result.push({ tag, count });
  }
  return result.sort(
    (a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name, "zh-Hans-CN"),
  );
}
