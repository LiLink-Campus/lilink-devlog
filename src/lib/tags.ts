import { tags, type Tag } from "../content/tags";

export type { Tag };

/** Look up a single tag by id. */
export function getTag(id: string): Tag | undefined {
  return tags[id];
}

/** Resolve a list of tag ids to Tag records, silently dropping unknown ids. */
export function resolveTags(ids: string[] | undefined): Tag[] {
  return (ids ?? []).map((id) => tags[id]).filter((t): t is Tag => Boolean(t));
}

/** Canonical URL for a tag's index page. */
export function tagHref(id: string): string {
  return "/tags/" + id;
}
