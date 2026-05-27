import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "zod";

// Files prefixed with `_` (e.g. the writing template) are excluded from the build.
const posts = defineCollection({
  loader: glob({ pattern: ["**/*.mdx", "!**/_*.mdx"], base: "./src/content/posts" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // Publish date. Drives ordering and the weekly timeline grouping.
      publishedAt: z.coerce.date(),
      // One-sentence, non-technical summary used in lists, RSS and social cards.
      summary: z.string(),
      cover: image().optional(),
      authors: z.array(z.string()).default(["LiLink 团队"]),
      // Highlights an occasional milestone entry on the timeline.
      featured: z.boolean().default(false),
      // Drafts are hidden in production builds but visible in `astro dev`.
      draft: z.boolean().default(false),
    }),
});

export const collections = { posts };
