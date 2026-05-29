/**
 * Bind click-to-load handlers on video facade buttons.
 * Shared by post pages (Video.astro) and the home book reader (index.astro),
 * so facades work even when the SSR'd newest entry has no <Video> in its body.
 */
export function mountVideoFacades(root: ParentNode = document): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>("button.facade[data-embed]");
  buttons.forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const embed = btn.dataset.embed;
      if (!embed) return;
      const iframe = document.createElement("iframe");
      iframe.src = embed;
      iframe.title = btn.dataset.title ?? "视频";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      iframe.setAttribute("allowfullscreen", "");
      iframe.className = "player";
      btn.replaceWith(iframe);
    });
  });
}
