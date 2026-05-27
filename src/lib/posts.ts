import { getCollection, type CollectionEntry } from "astro:content";
import { isoWeekKey, isoWeekParts, isoWeekRangeLabel } from "./dates";

export type Post = CollectionEntry<"posts">;

/** Published posts, newest first. Drafts are included only in `astro dev`. */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection("posts", ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
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
