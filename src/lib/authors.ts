export interface AuthorLink {
  label: string;
  href: string;
}

export interface Author {
  id: string;
  name: string;
  role?: string;
  bio?: string;
  links?: AuthorLink[];
}

// The controlled author registry. Posts reference authors by `id`.
export const authors = {
  "lilink-team": {
    id: "lilink-team",
    name: "LiLink 团队",
    role: "产品团队",
    bio: "认真打磨校园相遇体验的一群人。",
    links: [
      { label: "主站", href: "https://www.lilink.top" },
      { label: "RSS", href: "/rss.xml" },
    ],
  },
} satisfies Record<string, Author>;

export type AuthorId = keyof typeof authors;

export const authorIds: ReadonlySet<string> = new Set(Object.keys(authors));

/** Resolve author IDs to Author records. Unknown IDs throw (build-time safety). */
export function resolveAuthors(ids: readonly string[]): Author[] {
  return ids.map((id) => {
    const author = (authors as Record<string, Author>)[id];
    if (!author) {
      throw new Error(
        `Unknown author id "${id}". Allowed: ${[...authorIds].join(", ")}`,
      );
    }
    return author;
  });
}
