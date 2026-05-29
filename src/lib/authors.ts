import { authors, type Author } from "../content/authors";

export type { Author };

/** Look up a single author by id. */
export function getAuthor(id: string): Author | undefined {
  return authors[id];
}

/** Resolve a list of author ids to Author records, silently dropping unknown ids. */
export function resolveAuthors(ids: string[]): Author[] {
  return ids.map((id) => authors[id]).filter((a): a is Author => Boolean(a));
}
