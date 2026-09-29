---
title: SvelteKit
description: "A blog with server load functions."
section: Frameworks
order: 3
---

A blog whose posts are read in `+page.server.ts`, so a page gets only what it renders. [Open the example in StackBlitz](https://stackblitz.com/github/aayushbtw/tomekit/tree/main/examples/sveltekit).

## Setup

SvelteKit writes `compilerOptions.paths` itself, so add tomekit's types through its `typescript.config` hook instead of `tsconfig.json`. Paths are relative to `.svelte-kit/tsconfig.json`:

```ts title="vite.config.ts"
import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import { tomekit } from "tomekit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tomekit(),
    sveltekit({
      adapter: adapter(),
      typescript: {
        config: (config) => {
          config.compilerOptions.paths["tomekit/content"] = [
            "../.tomekit/content",
          ];
          config.compilerOptions.paths["tomekit/content*"] = [
            "../.tomekit/content*",
          ];
        },
      },
    }),
  ],
});
```

`svelte-check` runs on TypeScript 6, where `tomekit/content*` doesn't match `tomekit/content` itself, hence the two paths.

## The config

```ts title="tomekit.config.ts"
import { marked } from "marked";
import { defineConfig, directory } from "tomekit";
import { z } from "zod";

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts"),
      schema: z.strictObject({
        description: z.string(),
        publishedAt: z.coerce.date(),
        title: z.string(),
      }),
      transform: ({ body }) => ({ body: marked.parse(body, { async: false }) }),
    },
  },
});
```

## The routes

A `+page.server.ts` runs only on the server, so the index sends titles, not every post:

```ts title="src/routes/+page.server.ts"
import { posts } from "tomekit/content";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({
  posts: posts
    .documents()
    .toSorted(
      (a, b) =>
        b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime()
    )
    .map(({ metadata, slug }) => ({ slug, title: metadata.title })),
});
```

`params.slug` is a plain `string`, so `get` may return `undefined`; answer with a 404:

```ts title="src/routes/posts/[slug]/+page.server.ts"
import { error } from "@sveltejs/kit";
import { posts } from "tomekit/content";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const post = posts.get(params.slug);

  if (!post) {
    error(404, "Post not found");
  }

  return { post };
};
```

```svelte title="src/routes/posts/[slug]/+page.svelte"
<script lang="ts">
  let { data } = $props();
</script>

<article>
  <h1>{data.post.metadata.title}</h1>
  {@html data.post.body}
</article>
```

`publishedAt` arrives in the page as a `Date`: SvelteKit serializes load data with devalue, which keeps it one.
