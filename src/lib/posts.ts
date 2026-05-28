import { getCollection, type CollectionEntry } from "astro:content";
import { isoWeekKey, isoWeekParts, isoWeekRangeLabel } from "./dates";
import { getTag } from "./tags";

export type Post = CollectionEntry<"posts">;

/**
 * Published posts, newest first. In production only `status === "published"`
 * entries are returned; in `astro dev` drafts and review posts are visible too.
 */
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

export type TagCount = { tag: import("./tags").Tag; count: number };

/** All tags used across published posts, with usage counts. Sorted by count desc, then label. */
export async function getAllTagsWithCounts(): Promise<TagCount[]> {
  const posts = await getPublishedPosts();
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const id of post.data.tags) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const result: TagCount[] = [];
  for (const [id, count] of counts) {
    const tag = getTag(id);
    if (tag) result.push({ tag, count });
  }
  return result.sort(
    (a, b) => b.count - a.count || a.tag.label.localeCompare(b.tag.label),
  );
}

/** Published posts containing the given tag, newest first. */
export async function getPostsByTag(tagId: string): Promise<Post[]> {
  const posts = await getPublishedPosts();
  return posts.filter((post) => post.data.tags.includes(tagId));
}
