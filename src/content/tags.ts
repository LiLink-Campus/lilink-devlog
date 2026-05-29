import tagsJson from "./tags.json";

export interface Tag {
  id: string;
  name: string;
  description?: string;
}

/** The controlled tag vocabulary, keyed by id. */
export const tags: Record<string, Tag> = tagsJson;

/** Every registered tag id — used by the content schema to validate frontmatter. */
export const tagIds: string[] = Object.keys(tags);
