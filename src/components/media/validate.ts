/**
 * Build-time validation helpers shared by the media components.
 *
 * These enforce the rich-media conventions at the COMPONENT level so that
 * missing alt text, missing iframe titles or malformed embeds fail the build
 * immediately. Phase 4 adds a repo-wide scanning script that checks the same
 * conventions across all sources; keep the rules here in sync.
 *
 * Conventions enforced:
 *  - Local body images are imported via ESM from `./assets/...` and passed to
 *    Figure / Gallery as `ImageMetadata`; every image needs a non-empty `alt`.
 *  - Self-hosted videos live under `public/media/` and are referenced by an
 *    absolute `/media/...` path.
 *  - External embeds support only the `youtube` / `bilibili` providers and
 *    always require a non-empty `title`.
 */

/** True when a string is missing or only whitespace. */
export function isBlank(value: string | undefined | null): boolean {
  return value == null || value.trim().length === 0;
}

/**
 * Ensure an image has non-empty alt text. `where` identifies the call site in
 * the error (component name) and `src` is the resolved image path for context.
 */
export function assertAlt(where: string, alt: string, src: string): void {
  if (isBlank(alt)) {
    throw new Error(
      `${where}: alt text is required (src: ${src}). ` +
        `每张图片都必须提供非空的 alt 文本。`,
    );
  }
}

export type VideoProvider = "youtube" | "bilibili";

export const VIDEO_PROVIDERS: readonly VideoProvider[] = ["youtube", "bilibili"];

/** Builds the embed URL for a supported external video provider. */
export function providerEmbedUrl(provider: VideoProvider, id: string): string {
  switch (provider) {
    case "youtube":
      return `https://www.youtube.com/embed/${id}`;
    case "bilibili":
      return `https://player.bilibili.com/player.html?bvid=${id}`;
    default: {
      // Exhaustiveness guard — unreachable for the typed providers.
      const exhaustive: never = provider;
      throw new Error(
        `VideoEmbed: unsupported provider "${exhaustive}". ` +
          `仅支持：${VIDEO_PROVIDERS.join(" / ")}。`,
      );
    }
  }
}
