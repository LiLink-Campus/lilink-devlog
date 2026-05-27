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

## Open Graph 图片

```sh
npm run og:image   # 重新生成 public/og-default.png
```

## 部署

部署到 Vercel（framework 预设 `astro`，见 `vercel.json`）。站点公开 URL 可通过环境变量 `DEVLOG_SITE_URL` 覆盖，默认 `https://devlog.lilink.top`。
