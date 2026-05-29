import authorsJson from "./authors.json";

export interface Author {
  id: string;
  name: string;
  role?: string;
  bio?: string;
  links?: { label: string; href: string }[];
  avatar?: string | null;
}

/** All known authors, keyed by id. The single source of truth for bylines. */
export const authors: Record<string, Author> = authorsJson;

/** Every registered author id — used by the content schema to validate frontmatter. */
export const authorIds: string[] = Object.keys(authors);
