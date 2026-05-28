import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "zod";
import { authorIds } from "./lib/authors";
import { tagIds } from "./lib/tags";

// Files prefixed with `_` (e.g. the writing template) are excluded from the build.
const posts = defineCollection({
  loader: glob({ pattern: ["**/*.mdx", "!**/_*.mdx"], base: "./src/content/posts" }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        // Publish date. Drives ordering and the weekly timeline grouping.
        publishedAt: z.coerce.date(),
        // Optional "last updated" date, shown alongside the publish date.
        updatedAt: z.coerce.date().optional(),
        // One-sentence, non-technical summary used in lists, RSS and social cards.
        summary: z.string(),
        cover: image().optional(),
        // Author IDs from the registry in src/lib/authors.ts.
        authors: z.array(z.string()).default(["lilink-team"]),
        // Tag IDs from the registry in src/lib/tags.ts (max 4).
        tags: z.array(z.string()).max(4).default([]),
        // Highlights an occasional milestone entry on the timeline.
        featured: z.boolean().default(false),
        // draft / review are hidden in production builds but visible in `astro dev`.
        status: z.enum(["draft", "review", "published"]).default("published"),
      })
      // Validate author and tag ids against the controlled registries.
      .superRefine((data, ctx) => {
        for (const id of data.authors) {
          if (!authorIds.has(id)) {
            ctx.addIssue({
              code: "custom",
              path: ["authors"],
              message: `Unknown author id "${id}". Allowed: ${[...authorIds].join(", ")}`,
            });
          }
        }
        for (const id of data.tags) {
          if (!tagIds.has(id)) {
            ctx.addIssue({
              code: "custom",
              path: ["tags"],
              message: `Unknown tag id "${id}". Allowed: ${[...tagIds].join(", ")}`,
            });
          }
        }
      }),
});

export const collections = { posts };
