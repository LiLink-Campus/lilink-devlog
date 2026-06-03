# LiLink devlog 写作与发布指南

这份文档讲清楚三件事：怎么写一篇 devlog、怎么通过 PR 发布它、以及怎么维护作者 / 标签这些公共数据。

devlog 的调性是「暖色书卷」——写给用户看，不写技术黑话。每篇文章是产品某一次迭代背后的取舍记录。

---

## 1. 快速开始：写一篇新文章

1. 复制模板 `src/content/posts/_template.mdx`，重命名为 `YYYY-MM-DD-英文短横线slug.mdx`。
   - 例：`2026-06-03-faster-search.mdx`。
   - slug 只用**小写字母、数字、连字符**；文件名里的日期要和 frontmatter 的 `publishedAt` **完全一致**。
   - 下划线 `_` 开头的文件（如模板本身）永远不会被发布，可放心保留。
2. 填好 frontmatter（见下一节），正文用 Markdown / MDX 书写。
3. 本地预览：`npm run dev`，打开首页就能看到（草稿在本地也可见，见第 3 节）。
4. 提交前自查：`npm run validate`（详见第 5 节）。
5. 开 PR 发布（见第 4 节）。

> 文件名里的 slug 决定文章链接：`/posts/2026-06-03-faster-search`。
> 如果想用和文件名不同的链接，可在 frontmatter 里单独写 `slug:` 覆盖（一般不需要）。

---

## 2. frontmatter 字段

frontmatter 是文件顶部两行 `---` 之间的元数据。schema 定义在 `src/content.config.ts`，下面是每个字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 一句话标题，讲清楚「这次解决了什么」。 |
| `publishedAt` | 是 | 发布日期（`YYYY-MM-DD`）。决定排序和首页的「按周翻书」分组；必须等于文件名里的日期。 |
| `summary` | 是 | 一句人话概述，**不超过 120 字**。用于列表、RSS 和社交分享卡片。 |
| `status` | 是 | 发布状态：`draft` → `review` → `published`。详见第 3 节。 |
| `authors` | 否（默认 `["lilink-team"]`） | 作者 **id 数组**，不是显示名。每个 id 必须在 `src/content/authors.json` 里登记过。 |
| `tags` | 否（默认 `[]`） | 标签 **id 数组**，**最多 4 个**，每个 id 必须在 `src/content/tags.json` 里登记过。 |
| `updatedAt` | 否 | 文章发布后又修订时填，页面会显示「更新于」。 |
| `cover` | 否 | 封面图，写相对路径（如 `./assets/cover.png`，放在文章同目录的 `assets/` 下）。 |
| `coverAlt` | 否（设了 `cover` 就必填） | 封面的替代文字。**一旦设置了 `cover`，就必须同时写 `coverAlt`**，否则校验报错。 |
| `featured` | 否（默认 `false`） | 偶发的里程碑更新可开启，在时间线上做轻微强调（酒红 ★）。请克制使用。 |

最小示例：

```yaml
---
title: "搜索更快了：把首屏等待砍掉一半"
publishedAt: 2026-06-03
summary: "这期我们重做了搜索索引，结果出现得更快，输入时也更跟手。"
status: published
authors: ["lilink-team"]
tags: ["engineering", "product"]
---
```

**作者 / 标签都用 id，不是显示名。** 当前可用的 id 列表见 `src/content/authors.json` 和 `src/content/tags.json`；填错 id 时 `astro check` 和 `npm run validate` 都会报清晰的中文错误并列出所有已知 id。

---

## 3. 发布生命周期：draft → review → published

文章的可见性完全由 `status` 字段控制：

| status | 含义 | 本地 `npm run dev` | 生产 `npm run build` |
| --- | --- | --- | --- |
| `draft` | 草稿，还在写 | 可见 | **不发布** |
| `review` | 待审，等 reviewer 过目 | 可见 | **不发布** |
| `published` | 已发布 | 可见 | **发布** |

机制：`src/lib/posts.ts` 的 `getPublishedPosts()` 只在生产构建（`import.meta.env.PROD`）里过滤出 `status === "published"`；本地开发会显示**所有**状态，方便你边写边预览。标签页（`getPostsByTag`）、标签计数（`getAllTagsWithCounts`）和搜索索引（`/search-index.json`）都基于它，所以草稿 / 待审稿在生产里一律不会泄漏。

典型流程：
1. 新文章先写成 `status: draft`，本地反复预览打磨。
2. 准备让人审稿时改成 `status: review`，开 PR。
3. reviewer 认可后，把 `status` 改成 `published`（同一个 PR 里改，或合并前补一个 commit），合并即上线。

> CI 里有一道兜底：`npm run validate:build` 会检查 `dist/`，断言**没有任何** `draft` 或 `review` 的文章生成了 `dist/posts/<id>/index.html`，也不在 `dist/search-index.json` 里出现。万一漏改状态，CI 会拦住。

---

## 4. 通过 PR 发布

devlog 走 PR + CI + 合并自动部署的流程：

1. 新建分支，提交你的文章（含所有引用到的图片 / 视频文件）。
2. 开 Pull Request。PR 模板（`.github/pull_request_template.md`）里有一份文章自查清单，逐项勾掉。
3. CI（`.github/workflows/ci.yml`，名为 **CI**）自动在 PR 和推送到 `main` 时运行，依次跑：
   - `npm run check` —— Astro + TypeScript 类型检查
   - `npm run validate` —— 文章 / 注册表 / 替代文字 / 文件名校验（见第 5 节）
   - `npm run build` —— 生产构建（此时草稿 / 待审稿被排除）
   - `npm run validate:build` —— 检查构建产物里没有混入未发布文章
4. CI 全绿 + reviewer approve 后，合并到 `main`。
5. Vercel 监听 `main`，合并后自动部署（framework：astro）。

**本地先跑一遍 `npm run validate` 能省去 CI 来回。** 想完整复现 CI，可以依次跑 `npm run check && npm run validate && npm run build && npm run validate:build`。

---

## 5. 本地校验：`npm run validate`

校验脚本是 `scripts/validate-content.mjs`，逐篇检查 `src/content/posts/*.mdx`（跳过 `_` 开头的文件），任一项不过就以非 0 退出并打印清晰的逐文件信息。它检查：

- frontmatter 能正确解析；`title` / `publishedAt` / `summary` / `status` 都存在；
- `status` 是 `draft` / `review` / `published` 之一；
- `summary` 长度 ≤ 120；
- `authors` 里每个 id 都在 `src/content/authors.json`；
- `tags` 里每个 id 都在 `src/content/tags.json`，且不超过 4 个；
- 若设了 `cover`：封面文件确实存在，且写了 `coverAlt`；
- 正文里引用的本地图片 / 视频路径确实存在；富媒体组件（`<Figure>` / `<Gallery>` / `<Video>`）的本地 `src` 用 `public/` 根路径（`/media/...`），不是相对路径；
- 每个 Markdown 图片 `![alt](src)`、`<img>` / `<Figure>`、`<Gallery>` 的每个 item 都有**非空 alt**，每个 `<Video>` 都有**非空 title**；
- 若设了 frontmatter `slug` 覆盖：它是小写短横线格式，且全站唯一（不与其它文章的 slug / 文件名冲突）；
- 文件名形如 `YYYY-MM-DD-<slug>.mdx`（slug 为小写字母 / 数字 / 连字符），且文件名里的日期等于 `publishedAt`。

两条命令：

```bash
npm run validate        # 校验源文件（写作时随手跑）
npm run validate:build  # 加 --check-build，校验 dist/ 产物（一般交给 CI）
```

`npm run validate:build` 需要先 `npm run build` 生成 `dist/`。它断言没有 `draft` / `review` 文章出现在 `dist/posts/<id>/index.html` 或 `dist/search-index.json` 里。

---

## 6. 添加 / 维护作者

作者数据是一份注册表，文章用 id 引用它（一处维护，处处一致）。

1. 编辑 `src/content/authors.json`，以作者 id 为 key 新增一条：

   ```json
   {
     "your-id": {
       "id": "your-id",
       "name": "你的显示名",
       "role": "工程 · 全栈",
       "bio": "一句话自我介绍。",
       "links": [{ "label": "主站", "href": "https://www.lilink.top" }],
       "avatar": null
     }
   }
   ```

   - `id` 用小写短横线（如 `nanzhi`），要和 key 一致；
   - `role` / `bio` / `links` / `avatar` 都可选；`avatar` 没有就填 `null`。
2. 不需要改任何 `.ts`：`src/content/authors.ts` 会自动从 JSON 读出 `authors` 映射和 `authorIds` 列表，schema 校验、署名组件、搜索索引都从这里取数据。
3. 在文章 frontmatter 的 `authors: [...]` 里用这个新 id 即可。

> 显示在哪里：`AuthorByline`（元信息行的紧凑署名，用「、」连接）和 `AuthorBlock`（独立文章页脚的完整作者卡：名字 / 角色 / 简介 / 链接）。文章页脚的 JSON-LD 作者字段也用注册表里的名字。

---

## 7. 添加 / 维护标签

标签同理，也是一份注册表。

1. 编辑 `src/content/tags.json`，以标签 id 为 key 新增一条：

   ```json
   {
     "your-tag": {
       "id": "your-tag",
       "name": "中文显示名",
       "description": "一句话说明这个标签覆盖什么。"
     }
   }
   ```

   - `id` 用小写短横线，要和 key 一致；
   - `description` 可选，会显示在标签页上。
2. 同样不用改 `.ts`：`src/content/tags.ts` 自动导出 `tags` 映射和 `tagIds` 列表。
3. 在文章 frontmatter 的 `tags: [...]` 里使用（**每篇最多 4 个**）。

> 当前可用标签：`product`（产品）、`engineering`（工程）、`design`（设计）、`privacy`（隐私安全）、`community`（社区）、`growth`（增长）、`milestone`（里程碑）。新增前先看看现有标签够不够用，避免标签泛滥。

---

## 8. 在 MDX 里放图片 / 画廊 / 视频

正文渲染时会注入一组媒体组件（`src/components/mdx.ts`，通过 `<Content components={mdxComponents} />` 传入），所以**在 `.mdx` 里可直接使用这些标签，无需 import**：

> **媒体放哪里**：`<Figure>` / `<Gallery>` / `<Video>` 的 `src` 是**普通 URL**，不走 Astro 资源管线。把图片 / 视频放到 `public/`（例如 `public/media/2026-06-03/foo.png`），在 MDX 里用**根路径** `/media/2026-06-03/foo.png` 引用，或用远程 URL，并随 PR 一起提交。**不要**用 `./assets/` 相对路径——相对路径只对 frontmatter 的 `cover:` 有效（它走 `image()` 优化管线）。

### 8.1 `<Figure>` —— 单图（带可选图注）

```mdx
<Figure
  src="/media/2026-06-03/before-after.png"
  alt="改版前后的搜索结果对比"
  caption="左：旧版；右：新版，结果出现更快"
  width={1200}
  height={800}
/>
```

- `alt` **必填**（无障碍 + 校验都会要求）；`caption` / `width` / `height` 可选（建议填 `width`/`height` 以减少图片加载时的布局抖动）。
- 图片放在 `public/`（如 `public/media/2026-06-03/before-after.png`），用**根路径** `/media/...` 引用（或远程 URL），并随 PR 一起提交。**不支持** `./assets/` 相对路径（见上「媒体放哪里」）。
- 图片默认 `loading="lazy"`、`decoding="async"`。

也可以用普通 Markdown 图片 `![替代文字](/media/2026-06-03/x.png)`，同样**必须写非空替代文字**。

### 8.2 `<Gallery>` —— 多图网格

```mdx
<Gallery
  columns={3}
  items={[
    { src: "/media/2026-06-03/a.png", alt: "第一张", caption: "可选图注" },
    { src: "/media/2026-06-03/b.png", alt: "第二张" },
    { src: "/media/2026-06-03/c.png", alt: "第三张" }
  ]}
/>
```

- 每个 item 的 `alt` **必填**；`caption` / `width` / `height` 可选；`columns` 可选（响应式网格）。src 同样用 `public/` 根路径。

### 8.3 `<Video>` —— 本地或第三方视频

```mdx
<!-- 本地视频 -->
<Video title="新版搜索演示" src="/media/2026-06-03/demo.mp4" poster="/media/2026-06-03/demo-poster.png" />

<!-- 第三方：点击前不发起任何第三方请求（隐私友好遮罩） -->
<Video title="发布回顾" youtube="VIDEO_ID" />
<Video title="发布回顾" bilibili="BV_ID" />
```

- `title` **必填**。
- 给了 `src` 就用本地 `<video controls preload="none">`；
- 给了 `youtube` / `bilibili` 则显示一个「点击加载」遮罩，**用户点击前不会向第三方发起任何请求**，点击后才嵌入 iframe。这与 devlog 的隐私取向一致。

> 校验脚本会确保每个 `<Figure>` / `<img>` 与 `<Gallery>` 的每个 item 有非空 `alt`、每个 `<Video>` 有非空 `title`，引用的本地媒体确实存在，且组件 `src` 用的是 `public/` 根路径（不是 `./assets/` 相对路径）。

### 8.4 作者组件

正文里可以直接插入作者信息，数据来自 `src/content/authors.json`，无需在文章里重复写 GitHub 链接：

```mdx
### 更多技术细节 by <AuthorMention id="s3d-i" />:

<AuthorCard ids={["nanzhi", "s3d-i"]} />
```

- `<AuthorMention>` 适合放在标题或句子里，默认显示作者名，并链接到作者注册表里的第一条链接。
- `<AuthorCard>` 适合在正文中插入完整作者卡片，样式复用文章末尾的作者卡。
- `id` / `ids` 都必须是 `src/content/authors.json` 里已经注册过的作者 id。

---

## 9. 标签页与搜索是怎么工作的

- **标签总览 `/tags`**：列出所有出现在已发布文章里的标签及其文章数（`getAllTagsWithCounts`，按数量降序、再按名称排序）。
- **单个标签 `/tags/<id>`**：列出该标签下的已发布文章（日期 + 标题 + 概述）。标签链接由 `tagHref(id)` 生成（即 `/tags/<id>`）。
- **搜索 `/search`**：独立的搜索页（`src/pages/search.astro`），大号搜索框 + 下方结果列表；Header 里的"搜索"链接跳到这里，全局按 `/` 也会跳转。进页时懒加载 `/search-index.json`，在标题 / 概述 / 标签 / 作者 / 正文上做轻量模糊匹配，**无任何运行时第三方依赖**。查询词同步到 URL（`/search?q=关键词`），可分享、刷新保留。
- **搜索索引 `/search-index.json`**：由 `src/pages/search-index.json.ts` 基于 `getPublishedPosts()` 生成，所以**草稿 / 待审稿不会进索引**；正文会去掉 frontmatter / import / JSX 标签 / Markdown 标点后取约 2000 字纯文本。

这些页面和索引都基于第 3 节的发布过滤，未发布的文章不会出现在任何对外入口。

---

## 速查清单（提交前）

- [ ] 文件名 `YYYY-MM-DD-slug.mdx`，日期 = `publishedAt`
- [ ] `summary` ≤ 120 字
- [ ] `authors` / `tags` 都用注册表里的 id；`tags` ≤ 4 个
- [ ] 所有图片 / `<Figure>` 有非空 `alt`，`<Video>` 有 `title`
- [ ] 引用到的图片 / 视频文件已随 PR 提交
- [ ] `status` 设对了（送审 `review` / 发布 `published`）
- [ ] 本地 `npm run validate` 通过
