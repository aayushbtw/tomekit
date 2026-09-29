---
title: Register
description: Read collections in vite.config.ts and in scripts that run without Vite.
section: Tools
order: 2
---

Every build writes the generated module to `.tomekit/content.js`, next to its types. The file imports nothing, so a plain Node or Bun process can read the same typed collections through `tomekit/content`. Use it where the Vite plugin can't reach:

- `vite.config.ts`, eg to list every post to prerender. Vite loads its config before any plugin runs.
- Build steps that run on their own, eg a search index, Open Graph images, or uploading content elsewhere.

A feed or a sitemap doesn't need it: serve it from a route in your app, which reads collections through the plugin.

## Node

Run the script with `tomekit/register`:

```sh title="Terminal"
node --import tomekit/register scripts/search-index.ts
```

```ts title="scripts/search-index.ts"
import { posts } from "tomekit/content";

for (const post of posts.documents()) {
  console.log(post.metadata.title);
}
```

`tomekit/register` builds your collections before the script starts, so the script never reads stale content, and then sends imports of `tomekit/content` to `.tomekit/content.js`, and of `tomekit/content-modules` to `.tomekit/content-modules.js`. It reads `tomekit.config.ts` from the current folder and builds the way `vite build` does: broken content stops the script with every error, and `dev` is `false`, so drafts you skip outside dev are left out.

Without it, Node finds the placeholder that the `tomekit` package ships, and the import fails.

## vite.config.ts

Vite imports its config before any plugin runs, so the plugin can't provide `tomekit/content` there. Run Vite with `tomekit/register` instead, eg to list the pages to prerender:

```json title="package.json"
{
  "scripts": {
    "build": "NODE_OPTIONS='--import tomekit/register' vite build"
  }
}
```

```ts title="vite.config.ts"
import { posts } from "tomekit/content";

export default defineConfig({
  plugins: [
    tomekit(),
    tanstackStart({
      pages: posts.slugs().map((slug) => ({ path: `/posts/${slug}` })),
      prerender: { enabled: true },
    }),
  ],
});
```

Content is built twice this way, once for the config and once by the plugin.

## Bun

Bun reads the `tomekit/content*` path in `tsconfig.json`, so it imports `.tomekit/content.js` with no setup. Preload `tomekit/register` to build first, so the file is up to date:

```sh title="Terminal"
bun --preload tomekit/register scripts/search-index.ts
```

## Other tools

For a tool that reads the `tsconfig.json` path but can't preload a module, build the file first with the [CLI](/cli).
