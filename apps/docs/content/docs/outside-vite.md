---
title: Outside Vite
description: Read collections from Node scripts, Bun and vite.config.ts.
section: Concepts
order: 5
---

Every build writes the generated module to `.tomekit/content.js`, next to its types. The file imports nothing, so code outside Vite can read the same typed collections through `tomekit/content`.

## Node

Run the script with `tomekit/register`:

```sh
node --import tomekit/register scripts/feed.ts
```

```ts title="scripts/feed.ts"
import { posts } from "tomekit/content";

for (const post of posts.documents()) {
  console.log(post.metadata.title);
}
```

`tomekit/register` builds your collections before the script starts, so the script never reads stale content, and then sends imports of `tomekit/content` to `.tomekit/content.js`. It reads `tomekit.config.ts` from the current folder and builds the way `vite build` does: broken content stops the script with every error, and `dev` is `false`, so drafts you skip outside dev are left out.

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

```sh
bun --preload tomekit/register scripts/feed.ts
```
