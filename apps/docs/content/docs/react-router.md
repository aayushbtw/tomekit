---
title: React Router
description: "A blog in framework mode: config, loaders and routes."
section: Frameworks
order: 2
---

A blog whose posts are read in route loaders, so a page gets only what it renders. [Open the example in StackBlitz](https://stackblitz.com/github/aayushbtw/tomekit/tree/main/examples/react-router).

## Setup

Add the plugin before React Router's:

```ts title="vite.config.ts"
import { reactRouter } from "@react-router/dev/vite";
import { tomekit } from "tomekit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tomekit(), reactRouter()],
  resolve: { tsconfigPaths: true },
});
```

Point `tomekit/content` at the generated types, next to React Router's own paths:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./app/*"],
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

## The routes

A `loader` runs on the server, so the index sends titles, not every post:

```tsx title="app/routes/home.tsx"
import { Link } from "react-router";
import { posts } from "tomekit/content";

import type { Route } from "./+types/home";

export function loader() {
  return posts
    .documents()
    .toSorted(
      (a, b) =>
        b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime()
    )
    .map(({ metadata, slug }) => ({ slug, title: metadata.title }));
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <ul>
      {loaderData.map(({ slug, title }) => (
        <li key={slug}>
          <Link to={`/posts/${slug}`}>{title}</Link>
        </li>
      ))}
    </ul>
  );
}
```

`params.slug` is a plain `string`, so `get` may return `undefined`; answer with a 404:

```tsx title="app/routes/post.tsx"
import { data } from "react-router";
import { posts } from "tomekit/content";

import type { Route } from "./+types/post";

export function loader({ params }: Route.LoaderArgs) {
  const post = posts.get(params.slug);

  if (!post) {
    throw data(null, { status: 404 });
  }

  return post;
}

export default function Post({ loaderData: post }: Route.ComponentProps) {
  return (
    <article>
      <h1>{post.metadata.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.body }} />
    </article>
  );
}
```

`publishedAt` arrives in the component as a `Date`: React Router's single fetch keeps it one.
