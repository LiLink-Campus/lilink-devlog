import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "zod";
import { authorIds } from "./content/authors";
import { tagIds } from "./content/tags";

// Files prefixed with `_` (e.g. the writing template) are excluded from the build.
const posts = defineCollection({
  loader: glob({ pattern: ["**/*.mdx", "!**/_*.mdx"], base: "./src/content/posts" }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        // Optional URL override. Defaults to the file id (filename minus `.mdx`).
        // Kebab-case only — it becomes a URL path segment (no slashes/spaces).
        slug: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug 只能是小写字母、数字、连字符（会作为链接路径片段，不能含斜杠或空格）")
          .optional(),
        // Publish date. Drives ordering and the weekly timeline grouping.
        publishedAt: z.coerce.date(),
        // Optional "last updated" date, shown when a post is revised after publishing.
        updatedAt: z.coerce.date().optional(),
        // One-sentence, non-technical summary used in lists, RSS and social cards.
        summary: z.string().max(120, "summary 不能超过 120 个字符"),
        cover: image().optional(),
        // Alt text for the cover image (required when a cover is set — see refine below).
        coverAlt: z.string().optional(),
        // Author ids — must each exist in src/content/authors.json (validated below).
        authors: z.array(z.string()).default(["lilink-team"]),
        // Tag ids — at most 4, each must exist in src/content/tags.json (validated below).
        tags: z.array(z.string()).max(4, "最多只能有 4 个标签").default([]),
        // Editorial workflow: draft -> review -> published. Only `published` ships in prod.
        // Required, no default — keep this in lockstep with validate-content.mjs, which
        // also treats `status` as a mandatory field (a default here would let a post pass
        // the schema while still failing validation).
        status: z.enum(["draft", "review", "published"]),
        // Highlights an occasional milestone entry on the timeline.
        featured: z.boolean().default(false),
      })
      .superRefine((data, ctx) => {
        for (const id of data.authors) {
          if (!authorIds.includes(id)) {
            ctx.addIssue({
              code: "custom",
              path: ["authors"],
              message: `未知作者 id「${id}」——请先在 src/content/authors.json 注册。已知：${authorIds.join(", ")}`,
            });
          }
        }
        for (const id of data.tags) {
          if (!tagIds.includes(id)) {
            ctx.addIssue({
              code: "custom",
              path: ["tags"],
              message: `未知标签 id「${id}」——请先在 src/content/tags.json 注册。已知：${tagIds.join(", ")}`,
            });
          }
        }
        if (data.cover && !data.coverAlt) {
          ctx.addIssue({
            code: "custom",
            path: ["coverAlt"],
            message: "设置了 cover 就必须同时提供 coverAlt（封面的替代文字）。",
          });
        }
      }),
});

export const collections = { posts };
