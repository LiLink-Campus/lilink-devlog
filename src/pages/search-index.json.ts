import type { APIRoute } from "astro";
import { toIsoDate } from "../lib/dates";
import { resolveAuthors } from "../lib/authors";
import { resolveTags } from "../lib/tags";
import { getPublishedPosts, postPath } from "../lib/posts";

/** One searchable record per published post. Kept small and plaintext. */
interface SearchItem {
  id: string;
  url: string;
  title: string;
  summary: string;
  date: string;
  tags: string[];
  authors: string[];
  body: string;
}

const BODY_MAX_CHARS = 2000;

/**
 * Reduce raw MDX source to plain, searchable text:
 * strip frontmatter, import/export lines, code fences, JSX/HTML tags,
 * markdown link/image syntax and the common markup punctuation, then
 * collapse whitespace and truncate. Best-effort — the goal is recall in a
 * tiny client-side index, not a perfect Markdown renderer.
 */
function toPlainText(raw: string): string {
  let text = raw;

  // Drop a leading YAML frontmatter block if the body somehow still carries one.
  text = text.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, "");

  // Remove fenced code blocks entirely (```...``` and ~~~...~~~).
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/~~~[\s\S]*?~~~/g, " ");

  // Drop ESM import/export lines used by MDX (e.g. `import Foo from "..."`).
  text = text.replace(/^[ \t]*(?:import|export)\b.*$/gm, " ");

  // ![alt](src) -> alt ; [text](href) -> text
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Strip JSX / HTML tags, keeping inner text (e.g. <Figure .../> or <strong>x</strong>).
  text = text.replace(/<[^>]+>/g, " ");

  // Inline code -> its contents.
  text = text.replace(/`([^`]*)`/g, "$1");

  // Headings, blockquotes, list bullets, table pipes at line starts.
  text = text.replace(/^[ \t]*#{1,6}[ \t]+/gm, "");
  text = text.replace(/^[ \t]*>[ \t]?/gm, "");
  text = text.replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, "");
  text = text.replace(/\|/g, " ");

  // Remaining emphasis / markup punctuation.
  text = text.replace(/[*_~#>]+/g, " ");

  // Collapse all whitespace (incl. newlines) to single spaces.
  text = text.replace(/\s+/g, " ").trim();

  if (text.length > BODY_MAX_CHARS) {
    text = text.slice(0, BODY_MAX_CHARS);
  }
  return text;
}

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();

  const items: SearchItem[] = posts.map((post) => ({
    id: post.id,
    url: postPath(post),
    title: post.data.title,
    summary: post.data.summary,
    date: toIsoDate(post.data.publishedAt),
    tags: resolveTags(post.data.tags).map((t) => t.name),
    authors: resolveAuthors(post.data.authors).map((a) => a.name),
    body: toPlainText(post.body ?? ""),
  }));

  return new Response(JSON.stringify(items), {
    headers: { "content-type": "application/json" },
  });
};
