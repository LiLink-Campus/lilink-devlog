// Rich-media components made available to MDX article bodies.
//
// Pass this map to <Content /> when rendering a post so authors can write
// <Figure/>, <Gallery/> and <Video/> directly in their .mdx:
//
//   import { render } from "astro:content";
//   import { mdxComponents } from "../components/mdx";
//   const { Content } = await render(post);
//   <Content components={mdxComponents} />
//
// (Astro's MDX `components` prop maps a tag name to the component used to
// render it; this also lets you override built-in elements like `img` later.)
import Figure from "./media/Figure.astro";
import Gallery from "./media/Gallery.astro";
import Video from "./media/Video.astro";

export const mdxComponents = { Figure, Gallery, Video };
