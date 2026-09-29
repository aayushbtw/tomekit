---
title: Reading
description: Get collections, documents and slugs.
section: Concepts
order: 4
---

Everything is built ahead of time, so reading is synchronous. Import collections from server code only: in the browser bundle, their documents would ship to the client.

## Collections

Each collection is exported under its name in your config:

```ts
import { posts } from "tomekit/content";

posts.documents(); // every post
```

A module bundles only the collections it imports, so a page that reads `posts` doesn't load your other collections.

### Names known at runtime

When the collection's name is a string, eg a route param, read it from `collections`. It returns the same collection objects. `has` narrows a string to a collection name, and a plain string returns the collection or `undefined`:

```ts
import { collections } from "tomekit/content";

collections.names(); // ["docs", "posts"], in config order
collections.get(params.collection); // a collection, or undefined

if (collections.has(params.collection)) {
  collections.get(params.collection).documents();
}
```

Reading through `collections` bundles every collection, since the name could be any of them.

## Documents

```ts
posts.documents(); // every document, in the loader's order
posts.slugs(); // every slug, in the same order
posts.get("hello-world"); // the document
posts.get(params.slug); // the document, or undefined
posts.get("helo-world"); // doesn't compile
```

`get` follows the same rule as for collections: a slug that exists returns the document, a misspelled slug doesn't compile, and a plain string might return `undefined`. `has` narrows a string to a slug:

```ts
if (posts.has(params.slug)) {
  posts.get(params.slug).metadata.title;
}
```

Every document has four fields:

- `slug`: its key in the collection
- `metadata`: the schema's output, or what `transform` returned
- `body`: the text after the frontmatter, or what `transform` returned, eg a module's path for [MDX](/mdx)
- `file`: `{ path }`, relative to the project root, or `undefined` when its loader gave no file

`documents()` returns a plain array, so sort and filter it like any other:

```ts
const latest = posts
  .documents()
  .toSorted((a, b) => b.metadata.date.getTime() - a.metadata.date.getTime());
```

To list every document, combine `names()` and `get()`:

```ts
collections.names().flatMap((name) => collections.get(name).documents());
```

## Types

The plugin writes the types to `.tomekit` and rewrites them when content changes.

```ts
import type { CollectionName, DocumentOf, SlugOf } from "tomekit/content";

const name: CollectionName = "posts";
const slug: SlugOf<"posts"> = "hello-world";

function title(post: DocumentOf<"posts">) {
  return post.metadata.title;
}
```

- Leave the name out to mean any collection, eg `DocumentOf` for a document from any collection.
- Read a part of a document from `DocumentOf`, eg `DocumentOf<"posts">["metadata"]`.

For a helper that works with any collection whose documents fit, type it as `Collection` from `tomekit`:

```ts
import type { Collection } from "tomekit";

function titles<TDocument extends { metadata: { title: string } }>(
  collection: Collection<TDocument>
) {
  return collection.documents().map((document) => document.metadata.title);
}

titles(posts);
```
