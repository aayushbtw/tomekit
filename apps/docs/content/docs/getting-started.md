---
title: Quick start
description: Install tomekit, define a collection, read it typed.
section: Guide
order: 1
---

tomekit parses and validates your Markdown while Vite builds, then serves it as a generated module. Your pages read typed data, and nothing parses Markdown at runtime.

## Automatic

Paste this prompt into your coding agent, eg Claude Code, Codex or Cursor. It does every step under [Manual](#manual) for you and runs the build until it passes.

<!-- ::start:copy label="Copy prompt" -->

```text
Set up tomekit (https://tomekit.aayush.cv), typed Markdown content collections for Vite, in this project.

1. Install the npm package `tomekit` with this project's package manager, eg `pnpm add tomekit`. Check `package.json` for a Standard Schema validator (`zod`, `valibot` or `arktype`) and use it. Install `zod` only if none is there.

2. Read `node_modules/tomekit/dist/AGENTS.md` completely. It is the guide for the installed version; follow it over anything you remember about tomekit.

3. In `vite.config.ts`, import `tomekit` from `tomekit/vite` and add `tomekit()` to `plugins`, before any framework plugin.

4. In `tsconfig.json`, add `"tomekit/content*": ["./.tomekit/content*"]` to `compilerOptions.paths`. Add `.tomekit` to `.gitignore`.

5. Create `tomekit.config.ts` at the project root with a `posts` collection: `directory("content/posts")` as its loader and a strict object schema from that validator (`z.strictObject`, `v.strictObject` or ArkType's `"+": "reject"`). Add one post at `content/posts/hello-world.md` with YAML frontmatter that matches the schema.

6. Add these lines to `AGENTS.md` at the project root, creating the file if it doesn't exist:

   ## tomekit

   This project uses tomekit for content. Before writing code that touches `tomekit.config.ts` or imports from `tomekit`, read `node_modules/tomekit/dist/AGENTS.md` completely, and follow its links when needed.

7. Run the project's build, eg `pnpm build`, and fix every error it reports until it passes.
```

<!-- ::end:copy -->

## Manual

### 1. Install

<!-- ::install packages="tomekit zod" -->

Zod is the validator used below. Any [Standard Schema](https://standardschema.dev) validator works, eg Valibot or ArkType.

### 2. Add the plugin

```ts title="vite.config.ts"
import { tomekit } from "tomekit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tomekit()],
});
```

### 3. Add the types path

tomekit writes the generated module and its types to `.tomekit`. Point `tomekit/content*` at it in `tsconfig.json`, and add `.tomekit` to `.gitignore`:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "paths": { "tomekit/content*": ["./.tomekit/content*"] }
  }
}
```

### 4. Define a collection

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

### 5. Read it

```ts title="src/post.ts"
import { posts } from "tomekit/content";

const post = posts.get("hello-world");

post.metadata.title; // string
post.metadata.date; // Date, because the schema coerced it
post.body; // "The first post."
```

Both names are checked: `posts` comes from your config and `"hello-world"` from your files, so a typo is a type error, not a missing page. Content is read when Vite builds, so a new post shows up after a rebuild. Read collections from server code only, or their documents ship to the browser.

### 6. Set up AGENTS.md

The package ships a guide for coding agents at `node_modules/tomekit/dist/AGENTS.md`, matching the version you installed. Paste this into `AGENTS.md` at your project root, so agents read it before writing tomekit code:

<!-- ::start:copy label="Copy for AGENTS.md" -->

```md
## tomekit

This project uses tomekit for content. Before writing code that touches `tomekit.config.ts` or imports from `tomekit`, read `node_modules/tomekit/dist/AGENTS.md` completely, and follow its links when needed.
```

<!-- ::end:copy -->

In a monorepo, start the path from the root, eg `apps/web/node_modules/tomekit/dist/AGENTS.md`.

That is the whole setup. [Collections](/collections) covers loaders and schemas, [Transform](/transform) does the parsing once, at build time, and [TanStack Start](/tanstack-start), [React Router](/react-router) and [SolidStart](/solid-start) put both into a blog.

## Requirements

Vite 8, TypeScript 7 and Node 24, or later.
