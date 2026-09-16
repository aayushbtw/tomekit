---
title: Getting started
description: Install tomekit, define a collection, read it typed.
order: 1
---

tomekit parses and validates your Markdown while Vite builds, then serves it as a generated module. Your pages read typed data, and nothing parses Markdown at runtime.

## Install

<!-- ::install packages="tomekit zod" -->

Zod is the validator used below. Any [Standard Schema](https://standardschema.dev) validator works, eg Valibot or ArkType.

## Add the plugin

```ts title="vite.config.ts"
import { tomekit } from "tomekit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tomekit()],
});
```

## Add the types path

tomekit writes the generated module and its types to `.tomekit`. Point `tomekit/content*` at it in `tsconfig.json`, and add `.tomekit` to `.gitignore`:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "paths": { "tomekit/content*": ["./.tomekit/content*"] }
  }
}
```

## Define a collection

A collection is a named set of documents that share one `loader`, which says where they come from, and one `schema`, which every document's metadata must satisfy. Put them in `tomekit.config.ts` at the project root:

```ts title="tomekit.config.ts"
import { defineConfig, directory } from "tomekit";
import { z } from "zod";

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts"),
      schema: z.strictObject({ title: z.string(), date: z.coerce.date() }),
    },
  },
});
```

`directory()` reads every Markdown file under `content/posts`. Each file becomes one document: its frontmatter is the `metadata`, the text below is the `body`, and its path without the extension is the `slug`.

```md title="content/posts/hello-world.md"
---
title: Hello world
date: 2026-09-16
---

The first post.
```

## Read it

```ts title="src/post.ts"
import { collections } from "tomekit/content";

const post = collections.get("posts").get("hello-world");

post.metadata.title; // string
post.metadata.date; // Date, because the schema coerced it
post.body; // "The first post."
```

Both names are checked: `"posts"` comes from your config and `"hello-world"` from your files, so a typo is a type error, not a missing page. Content is read when Vite builds, so a new post shows up after a rebuild. Read `collections` from server code only, or every document ships to the browser.

That is the whole setup. [Collections](/collections) covers loaders and schemas, [Transform](/transform) does the parsing once, at build time, and [TanStack Start](/tanstack-start) puts both into a blog.

## Requirements

Vite 8, TypeScript 7 and Node 24, or later.
