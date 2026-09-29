---
title: Transform
description: Parse Markdown once, at build time.
section: Guide
order: 3
---

`transform` runs on each document at build time, after the schema. Do the expensive work here, eg rendering Markdown, so pages only read the result.

## Returning metadata and body

`transform` receives the source, `{ slug, metadata, body, file }`, and returns a new `metadata` and/or `body`. Whatever it leaves out stays as it was, and the types of what it returns become the document's.

```ts title="tomekit.config.ts"
import { marked } from "marked";

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts"),
      schema: z.strictObject({ title: z.string() }),
      transform: ({ body, metadata, slug }, { collection }) => ({
        body: marked.parse(body, { async: false }),
        metadata: { ...metadata, url: `/${collection}/${slug}` },
      }),
    },
  },
});
```

- Put derived values inside `metadata`. `slug` and `file` can't change, and any other top-level field is an error. In `defineCollection` it's a type error; in a transform written inline in `defineConfig`, it only fails the build, so prefer `defineCollection` for a transform that returns new fields.
- Return data only: plain objects, arrays, strings, numbers, booleans, `null`, `Date`, `Map`, `Set`, `URL` and `RegExp`. A function or a class instance fails the build, naming its key path. TypeScript doesn't check this, since Markdown ASTs are too deeply recursive to type.
- `body` can also be a file your bundler compiles, eg an MDX file. See [MDX](/mdx).
- `transform` can be `async`.
- Results are cached, so `transform` reruns only for entries that changed. See [Caching](#caching).

The second argument holds:

- `collection`: the collection's name
- `dev`: whether the Vite dev server is running
- `skip`: leaves the document out, see below

## Skipping a document

Return `skip()` to leave a document out of its collection. A reason is optional.

```ts
transform: ({ metadata }, { dev, skip }) =>
  metadata.draft && !dev ? skip("draft") : {},
```

A skipped document isn't in `documents()`, `slugs()` or the generated types. A [reference](/collections#references) to it fails the build.

## Sharing a transform

To use one transform in several collections, write it as a generic function and type its first parameter as `Source`.

```ts
import type { Source, TransformContext } from "tomekit";

function withUrl<TMetadata extends object>(
  { metadata, slug }: Source<TMetadata>,
  { collection }: TransformContext
) {
  return { metadata: { ...metadata, url: `/${collection}/${slug}` } };
}
```

Each collection that uses `withUrl` keeps its own schema's fields, plus `url`.

## Caching

tomekit keeps each transform's result in `.tomekit/cache`, so the next build, dev server, `tomekit build` or `tomekit/register` run calls `transform` only for entries whose slug, file path, metadata or body changed.

Every result is thrown away when any of these change:

- `tomekit.config.ts`, or a file it imports
- your lockfile, eg after installing or upgrading a package
- the version of tomekit

Dev and builds keep separate results, since `dev` can change what a transform returns. A collection without `transform` isn't cached on disk, since it would save less than reading the cache costs. Without a lockfile, results are kept only in memory, while the dev server runs.

So `transform` must depend only on its arguments and the code it imports. Read anything else, eg a file's last commit date or data from an API, in a [loader](/collections#your-own-loader), which runs on every build, and pass it in as metadata.

tomekit can't see changes to a package linked from your workspace, since the lockfile stays the same. After editing one that a transform uses, delete `.tomekit/cache`. Deleting `.tomekit` is always safe: the next build writes it again.
