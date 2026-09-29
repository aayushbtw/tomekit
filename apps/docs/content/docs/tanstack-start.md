---
title: TanStack Start
description: "A blog, end to end: config, server functions and routes."
section: Frameworks
order: 1
---

A blog with posts and authors, parsed at build time and read through server functions. This site is built the same way. For a smaller one with posts only, [open the example in StackBlitz](https://stackblitz.com/github/aayushbtw/tomekit/tree/main/examples/tanstack-start).

## The content

Two folders: `content/posts` and `content/authors`. A post names its author by slug, so `content/posts/hello-world.md` is:

```md title="content/posts/hello-world.md"
---
title: Hello world
author: ada
publishedAt: 2026-09-16
---

The first post.
```

## The config

`transform` parses each post's Markdown once, at build time, so a page only renders the result. `references` says that a post's `author` is an author's slug, and the build fails on one that doesn't exist.

```ts title="tomekit.config.ts"
import { parseMarkdown } from "@tanstack/markdown/parser";
import { defineConfig, directory } from "tomekit";
import { z } from "zod";

export default defineConfig({
  collections: {
    authors: {
      loader: directory("content/authors"),
      schema: z.strictObject({ name: z.string() }),
    },
    posts: {
      loader: directory("content/posts"),
      schema: z.strictObject({
        author: z.string(),
        draft: z.boolean().default(false),
        publishedAt: z.coerce.date(),
        title: z.string(),
      }),
      transform: ({ body, metadata }, { dev, skip }) =>
        metadata.draft && !dev
          ? skip("draft")
          : { body: parseMarkdown(body, { headingIds: true }) },
    },
  },
  references: { posts: { author: "authors" } },
});
```

A draft is skipped everywhere except dev, so it is not in `documents()`, not in `slugs()` and not in the generated types.

## The server functions

A collection holds all of its documents, so keep it on the server: a route that imports it ships them to the browser. Read it in a server function and return only what the page renders.

```ts title="src/server/posts.ts"
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { authors, posts } from "tomekit/content";

const getPosts = createServerFn({ method: "GET" }).handler(() =>
  posts
    .documents()
    .toSorted(
      (a, b) =>
        b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime()
    )
    .map(({ metadata, slug }) => ({ slug, title: metadata.title }))
);

const getPost = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(({ data: slug }) => {
    const post = posts.get(slug);

    if (!post) {
      throw notFound();
    }

    const author = authors.get(post.metadata.author);

    return { ...post, author: author.metadata.name };
  });

export { getPost, getPosts };
```

`get(slug)` takes a plain string, so it may return `undefined`. `get(post.metadata.author)` doesn't: the field is typed as an author's slug, because the reference was checked at build time.

## The routes

```tsx title="src/routes/index.tsx"
import { createFileRoute, Link } from "@tanstack/react-router";

import { getPosts } from "#/server/posts";

export const Route = createFileRoute("/")({
  loader: () => getPosts(),
  component: Posts,
});

function Posts() {
  return (
    <ul>
      {Route.useLoaderData().map(({ slug, title }) => (
        <li key={slug}>
          <Link params={{ slug }} to="/posts/$slug">
            {title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

The body is already a parsed document, so the page renders it without a Markdown parser in the bundle.

```tsx title="src/routes/posts.$slug.tsx"
import { Markdown } from "@tanstack/markdown/react";
import { createFileRoute } from "@tanstack/react-router";

import { getPost } from "#/server/posts";

export const Route = createFileRoute("/posts/$slug")({
  loader: ({ params }) => getPost({ data: params.slug }),
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.metadata.title }] }),
  component: Post,
});

function Post() {
  const { author, body, metadata } = Route.useLoaderData();

  return (
    <article>
      <h1>{metadata.title}</h1>
      <p>{author}</p>
      <Markdown>{body}</Markdown>
    </article>
  );
}
```

## Prerendering

Every post is known before the server starts, so the whole blog can be static. Let the crawler follow the links from the index page:

```ts title="vite.config.ts"
export default defineConfig({
  plugins: [
    tomekit(),
    tanstackStart({ prerender: { crawlLinks: true, enabled: true } }),
  ],
});
```

To list the paths yourself instead, import `posts` in `vite.config.ts` and run Vite with `tomekit/register`, as [Register](/register) shows.
