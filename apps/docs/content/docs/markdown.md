---
title: Markdown
description: Render Markdown once, at build time, to HTML or a tree your components render.
section: Content
order: 1
---

A document's `body` is the Markdown text after the frontmatter. Render it in `transform`, so it's rendered once while Vite builds and pages only read the result.

## To HTML

Return the HTML as the body:

```ts title="tomekit.config.ts"
import { marked } from "marked";
import { defineConfig, directory } from "tomekit";
import { z } from "zod";

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts"),
      schema: z.strictObject({ title: z.string() }),
      transform: ({ body }) => ({ body: marked.parse(body, { async: false }) }),
    },
  },
});
```

`body` is then typed as `string`, and a page sets it as HTML, eg with `dangerouslySetInnerHTML` in React. The HTML can't hold your own components.

## To a tree

To render Markdown with your own components, return a parsed tree instead. The tree is plain data, so it's written into the generated module like any other value, and the page renders it without a Markdown parser in its bundle. [TanStack Start](/tanstack-start) shows this with `@tanstack/markdown`.

For components written inside the content itself, use [MDX](/mdx).

## Headings

`transform` can return `metadata` too, eg the headings for a table of contents, collected from the same parse:

```ts title="tomekit.config.ts"
import { collectMarkdownHeadings } from "@tanstack/markdown/extensions/headings";
import { parseMarkdown } from "@tanstack/markdown/parser";

transform: ({ body, metadata }) => {
  const document = parseMarkdown(body, { headingIds: true });
  const headings = collectMarkdownHeadings(document);

  return { body: document, metadata: { ...metadata, headings } };
},
```

This site does the same.
