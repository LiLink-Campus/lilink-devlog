// Dependency-free search module shared by the build-time index endpoint
// (src/pages/search-index.json.ts) and the client search page (src/pages/search.astro).
//
// IMPORTANT: keep this file free of Astro (`astro:content`) and Node built-in
// imports so it bundles cleanly for the browser. Only `mdxToPlainText` runs at
// build time (from the endpoint); `fuzzySearch` runs in the browser.

/** One indexed, searchable post record (mirrors the JSON emitted at build). */
export interface SearchDoc {
  id: string;
  url: string;
  title: string;
  summary: string;
  date: string; // ISO date (YYYY-MM-DD)
  dateLabel: string; // human label, e.g. "2026年5月23日"
  tags: string[]; // resolved tag labels (Chinese), for display + search
  tagIds: string[]; // raw tag ids (for linking if needed)
  authors: string[]; // resolved author names
  text: string; // plain-text body, stripped + whitespace-collapsed
}

/** A scored match returned by `fuzzySearch`. */
export interface SearchResult {
  doc: SearchDoc;
  score: number;
}

// ---------------------------------------------------------------------------
// MDX -> plain text (build-time only)
// ---------------------------------------------------------------------------

/**
 * Strip MDX/Markdown/JSX down to plain text suitable for full-text indexing.
 *
 * `post.body` from a glob content collection already excludes frontmatter, but
 * we defensively strip a leading `---...---` block just in case. CJK runs are
 * preserved; everything is collapsed to single-spaced plain text.
 */
export function mdxToPlainText(raw: string): string {
  let s = raw;

  // Defensive: drop a leading frontmatter block if present.
  s = s.replace(/^﻿?\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

  // Remove fenced code blocks entirely (```...``` and ~~~...~~~).
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/~~~[\s\S]*?~~~/g, " ");

  // Remove ESM import/export statements (component/asset wiring).
  s = s.replace(/^[ \t]*(?:import|export)\b.*$/gm, " ");

  // Drop JSX/HTML tags (opening, closing, self-closing, multi-line).
  s = s.replace(/<[^>]+>/g, " ");

  // Markdown images: ![alt](url) -> keep alt text, drop the url.
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Markdown links: [text](url) -> keep text, drop the url.
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Inline code backticks -> keep the contents.
  s = s.replace(/`([^`]*)`/g, "$1");

  // Heading markers, blockquote markers, list bullets at line start.
  s = s.replace(/^[ \t]*#{1,6}[ \t]*/gm, "");
  s = s.replace(/^[ \t]*>[ \t]?/gm, "");
  s = s.replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, "");

  // Emphasis / bold / strikethrough markers (leave the words).
  s = s.replace(/(\*\*|__|\*|_|~~)/g, "");

  // Horizontal rules left behind (--- or ***).
  s = s.replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, " ");

  // Collapse all whitespace to single spaces.
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

// ---------------------------------------------------------------------------
// Fuzzy / relevance search (client-side)
// ---------------------------------------------------------------------------

// Per-field weights: title matters most, body text least.
const WEIGHT = {
  title: 10,
  tags: 6,
  authors: 5,
  summary: 4,
  text: 1.5,
} as const;

// A query is "CJK-ish" (no useful word boundaries) when it has no spaces and
// contains CJK characters — we then also try whole-query substring matching.
const CJK_RE = /[㐀-鿿豈-﫿぀-ヿ]/;

/**
 * Lightweight subsequence test: are all chars of `needle` present in `hay` in
 * order? Used for a small typo/partial bonus on titles only.
 */
function isSubsequence(needle: string, hay: string): boolean {
  if (!needle) return false;
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) {
    if (hay[j] === needle[i]) i++;
  }
  return i === needle.length;
}

/** Count non-overlapping occurrences of `token` in `hay` (both lowercased). */
function countOccurrences(hay: string, token: string): number {
  if (!token) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = hay.indexOf(token, from);
    if (idx === -1) break;
    count++;
    from = idx + token.length;
  }
  return count;
}

/**
 * Score a single token against one doc. Returns the summed weighted score and
 * whether the token matched anywhere (for AND semantics across tokens).
 */
function scoreToken(token: string, doc: SearchDoc): { score: number; matched: boolean } {
  const title = doc.title.toLowerCase();
  const summary = doc.summary.toLowerCase();
  const text = doc.text.toLowerCase();
  const tags = doc.tags.map((t) => t.toLowerCase());
  const authors = doc.authors.map((a) => a.toLowerCase());

  let score = 0;
  let matched = false;

  // Title: substring (strong) + word-start bonus + subsequence (light) bonus.
  const titleHits = countOccurrences(title, token);
  if (titleHits > 0) {
    score += WEIGHT.title * titleHits;
    if (title.startsWith(token)) score += WEIGHT.title; // leading match bonus
    matched = true;
  } else if (isSubsequence(token, title)) {
    // Forgiving fuzzy: typo/partial still surfaces, but weakly.
    score += WEIGHT.title * 0.3;
    matched = true;
  }

  // Tags: any tag containing the token.
  for (const tag of tags) {
    if (tag.includes(token)) {
      score += WEIGHT.tags;
      matched = true;
    }
  }

  // Authors.
  for (const author of authors) {
    if (author.includes(token)) {
      score += WEIGHT.authors;
      matched = true;
    }
  }

  // Summary.
  const summaryHits = countOccurrences(summary, token);
  if (summaryHits > 0) {
    score += WEIGHT.summary * summaryHits;
    matched = true;
  }

  // Body text (capped contribution so a long post can't dominate).
  const textHits = countOccurrences(text, token);
  if (textHits > 0) {
    score += WEIGHT.text * Math.min(textHits, 5);
    matched = true;
  }

  return { score, matched };
}

/**
 * Fuzzy / relevance search over the indexed docs. Dependency-free; a linear
 * scan is plenty for this scale.
 *
 * - Tokenizes the query on whitespace (AND semantics: every token must match
 *   somewhere, or the doc is excluded).
 * - For CJK queries with no spaces, also matches the whole query as a substring
 *   (so single-character / phrase CJK queries stay forgiving).
 * - Sorts by score desc, then by date desc.
 */
export function fuzzySearch(query: string, docs: SearchDoc[], limit = 20): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  // For a CJK query with spaces (rare), also test the whole query as one
  // substring token so a contiguous phrase still surfaces forgivingly.
  const wholeQuery = q.replace(/\s+/g, "");
  const useWholeQuery = tokens.length > 1 && CJK_RE.test(q);

  const results: SearchResult[] = [];

  for (const doc of docs) {
    let total = 0;
    let allMatched = true;

    for (const token of tokens) {
      const { score, matched } = scoreToken(token, doc);
      if (!matched) {
        allMatched = false;
        break;
      }
      total += score;
    }

    // CJK phrase bonus: reward a contiguous whole-query substring match.
    if (allMatched && useWholeQuery) {
      const { score } = scoreToken(wholeQuery, doc);
      total += score;
    }

    if (allMatched && total > 0) {
      results.push({ doc, score: total });
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.doc.date.localeCompare(a.doc.date);
  });

  return results.slice(0, limit);
}
