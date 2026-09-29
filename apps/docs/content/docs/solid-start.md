---
title: SolidStart
description: "A blog with server queries."
section: Frameworks
order: 3
---

A blog whose posts are read in `"use server"` queries, so a page gets only what it renders. [Open the example in StackBlitz](https://stackblitz.com/github/aayushbtw/tomekit/tree/main/examples/solid-start).

## Setup

Add the plugin before SolidStart's:

```ts title="vite.config.ts"
import { solidStart } from "@solidjs/start/config";
import { nitro } from "nitro/vite";
import { tomekit } from "tomekit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tomekit(), solidStart(), nitro()],
});
```

```json title="tsconfig.json"
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./src/*"],
      "tomekit/content*": ["./.tomekit/content*"]
    }
  }
}
```

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

## The queries

`"use server"` keeps the collection on the server; the index gets titles, not every post:

```ts title="src/lib/posts.ts"
import { query } from "@solidjs/router";
import { posts } from "tomekit/content";

const getPosts = query(async () => {
  "use server";

  return posts
    .documents()
    .toSorted(
      (a, b) =>
        b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime()
    )
    .map(({ metadata, slug }) => ({ slug, title: metadata.title }));
}, "posts");

const getPost = query(async (slug: string) => {
  "use server";

  return posts.get(slug);
}, "post");

export { getPost, getPosts };
```

## The routes

`get` takes the slug from the URL, a plain `string`, so it may return `undefined`; render a 404 for it:

```tsx title="src/routes/posts/[slug].tsx"
import { createAsync, useParams } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { Show } from "solid-js";

import { getPost } from "~/lib/posts";

export default function Post() {
  const params = useParams<{ slug: string }>();
  const post = createAsync(() => getPost(params.slug));

  return (
    <Show
      fallback={
        <>
          <HttpStatusCode code={404} />
          <h1>Post not found</h1>
        </>
      }
      when={post()}
    >
      {(post) => (
        <article>
          <h1>{post().metadata.title}</h1>
          <div innerHTML={post().body} />
        </article>
      )}
    </Show>
  );
}
```

`publishedAt` arrives in the page as a `Date`: server functions serialize with seroval, which keeps it one.
