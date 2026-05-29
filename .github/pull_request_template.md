<!--
  感谢投稿 LiLink devlog！
  合并前 CI 会自动跑：npm run check · npm run validate · npm run build · npm run validate:build。
  本地先跑一遍 `npm run validate` 能省去来回。文章写作规范见 docs/authoring.md。
-->

## 这次改了什么

<!-- 一两句话：新增/修改了哪篇文章，或改了哪块功能。 -->

## 文章自查清单

> 只改代码、不涉及文章时，可整体跳过本节并说明。

- [ ] **frontmatter 完整**：`title` / `publishedAt` / `summary`（≤ 120 字）/ `status` 都已填写
- [ ] **文件名规范**：`YYYY-MM-DD-英文短横线slug.mdx`，且日期与 `publishedAt` 一致
- [ ] **作者用 id**：`authors` 里每个 id 都已在 `src/content/authors.json` 登记
- [ ] **标签用 id 且 ≤ 4 个**：`tags` 里每个 id 都已在 `src/content/tags.json` 登记
- [ ] **媒体都有替代文字**：每个 `![]()` / `<Figure>` 写了非空 `alt`，每个 `<Video>` 写了 `title`
- [ ] **媒体文件已提交**：封面与正文引用的本地图片都随本 PR 一起提交（放在文章同目录的 `assets/` 下）
- [ ] **状态已设置**：送审填 `status: review`，确定发布填 `status: published`
- [ ] **本地已跑** `npm run validate` 且通过

## 备注

<!-- 需要 reviewer 特别留意的点；没有可删。 -->
