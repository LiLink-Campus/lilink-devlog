# lilink-devlog

LiLink 开发日志（dev log）静态站点，部署于 **[devlog.lilink.top](https://devlog.lilink.top)**。

基于 [Astro](https://astro.build/) 的内容站点：文章以 MDX 形式存放在 `src/content/posts/`，构建时生成静态页面、RSS 与站点地图。本仓库独立于 LiLink 主仓库（monorepo），单独开发与部署。

## 技术栈

- Astro 6 + MDX 内容集合
- `@astrojs/rss`（RSS）、`@astrojs/sitemap`（站点地图）
- `sharp` 生成 Open Graph 分享图

## 本地开发

```sh
npm install
npm run dev        # 本地开发服务器
npm run build      # 生产构建，输出到 dist/
npm run preview    # 预览构建产物
npm run check      # Astro 类型检查
```

## 写一篇新日志

复制模板并按日期命名：

```sh
cp src/content/posts/_template.mdx src/content/posts/YYYY-MM-DD-slug.mdx
```

填写 frontmatter（标题、日期、摘要等，schema 见 `src/content.config.ts`）后写正文即可。

## 发布流程（draft → review → published）

文章采用基于 PR 的发布流程，由 frontmatter 中的 `status` 字段控制生命周期：

- `draft`：草稿，正在撰写。
- `review`：评审中，等待合并。
- `published`：已发布（`status` 缺省即视为 `published`）。

`draft` 与 `review` 的文章在 `astro dev` 下可见，便于本地预览；但生产构建会通过 `src/lib/posts.ts` 的 `getPublishedPosts()` 自动排除它们，因此未发布内容不会出现在线上。

每个 PR 都会在 CI（`.github/workflows/ci.yml`）中运行 `npm run ci`（等价于 `validate` + `check` + `build`），三者全部通过才能合并：

```sh
npm run validate   # 校验全部文章
npm run ci         # = validate && check && build（CI 同款）
```

`npm run validate`（`scripts/validate-content.mjs`）会扫描 `src/content/posts/*.mdx`（跳过 `_*.mdx`）并校验：

- frontmatter 完整、格式正确：必填 `title`/`publishedAt`/`summary`，日期为合法 ISO，`status` 取值合法，`featured` 为布尔，`tags` ≤ 4。
- `authors` 中每个 ID 都在作者注册表 `src/lib/authors.ts` 内。
- `tags` 中每个 ID 都在标签注册表 `src/lib/tags.ts` 内，且数量 ≤ 4。
- 媒体路径可解析：`cover`、正文中的 `import` 图片、`/media/...` 自托管视频、Markdown 图片均需存在，且 Markdown 图片必须带非空 `alt`。
- 内部链接有效：`/posts/<slug>` 指向存在的文章、`/tags/<id>` 指向已知标签。
- 草稿暴露守卫：`published` 文章不得链接到 `draft`/`review` 文章。

因此撰写时需遵循作者/标签注册表与富媒体规则（图片需 `alt`、外部嵌入需 `title`、自托管视频放在 `public/media/` 下）。

## Open Graph 图片

```sh
npm run og:image   # 重新生成 public/og-default.png
```

## 搜索

`/search` 提供站内模糊搜索，覆盖标题、摘要、标签、作者与正文。构建时在
`src/pages/search-index.json.ts` 生成静态索引 `/search-index.json`（仅含
`published` 文章），前端在 `src/lib/search.ts` 中做无依赖的模糊匹配与排序。

## 部署

部署到 Vercel（framework 预设 `astro`，见 `vercel.json`）。站点公开 URL 可通过环境变量 `DEVLOG_SITE_URL` 覆盖，默认 `https://devlog.lilink.top`。
