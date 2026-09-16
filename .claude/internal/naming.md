# Naming

One word per concept, used everywhere that concept appears: code, generated types, errors, README, and internal names too. Before naming anything new, find its concept here. If none fits, add a row before writing the code. Don't invent generic words (`keys`, `values`, `items`) where a concept already has a name.

| Concept | Word | Where it appears |
| --- | --- | --- |
| The package's domain: what a site is built from, eg Markdown files or entries from an API | **content** | `tomekit/content` import path, `content/` folders, `ContentError`, `BrokenContentError`, "content file" in messages |
| One file on disk, before it is parsed | **file** | `directory()`'s `include` / `exclude` globs, `document.file`, `FileInfo`, `file:line:column` in errors |
| A named set of documents with one loader and one schema | **collection** | `defineCollection`, config `collections: {}`, `CollectionConfig`, `Collection`, `CollectionName`, the root export `collections` |
| A collection's key | **name** | `names()`, `CollectionName`, `context.collection` holds one |
| One validated entry: always `slug`, `metadata`, `body`, `file` | **document** | `get(slug)`, `documents()`, `DocumentOf` |
| A document's key inside its collection, set by the loader. `directory()` uses frontmatter `slug`, or the file path without the extension | **slug** | `document.slug`, `slugs()`, `SlugOf` |
| An entry's data, validated by the schema. For a file, its frontmatter | **metadata** | `document.metadata`, typed by the collection's `schema` |
| An entry's text, eg a file's after the frontmatter block, or what `transform` made of it | **body** | `document.body` |
| Where a collection's entries come from | **loader** | config `loader`, `Loader`, `load`, `LoadContext.watch`, `directory()`. Internal code never uses the word for anything else (the state class is `ContentBuilder`) |
| One document as a loader returns it, before the schema | **entry** | `Entry`, `LoadResult.entries`, `collections.get("x").get("y")` in errors for an entry without a file |
| Whether the Vite dev server is running, as opposed to a build | **dev** | `LoadContext.dev`, `TransformContext.dev` |
| A document before `transform`: `body` is the raw text, `metadata` the schema's output | **source** | `transform(source)`, `Source<TMetadata>` |
| A metadata field that holds slugs of a collection, checked after every collection loads | **reference** | config `references`, `WithReferences`, `reference.ts` |

## Reading

Methods, like `Map`, each named after what it returns. Each level has the members its concept needs, not a shared generic set.

| | `collections` | A collection |
| --- | --- | --- |
| List keys | `names()`: collection names, config order | `slugs()`: slugs, loader order |
| One item | `get(name)`: a collection | `get(slug)`: a document |
| Check a key | `has(name)`: narrows to `CollectionName` | `has(slug)`: narrows to `SlugOf` |
| List items | none: combine `names()` and `get()` | `documents()`: documents, loader order |

How each member behaves, including what fails to compile, is in the docs site's `reading.md`.

## Types

One generic per concept. Leaving out the name means any collection.

- `CollectionName`
- `DocumentOf<"posts">`, `DocumentOf`
- `SlugOf<"posts">`, `SlugOf`
- `Source<TMetadata>`: for writing a shared transform

A part of a document is read from `DocumentOf`, eg `DocumentOf<"posts">["metadata"]`, not a separate `MetadataOf`. No per-collection named types (`Posts`), no `Any*` aliases, and no type named `Document`, which shadows the browser's global.

## Rules

- Reading members are methods and return plain arrays, so `.filter` and `.map` work.
- A list is named after what it holds: `slugs()`, `names()`, `documents()`.
- A field that refers to something holds its key: `context.collection` is a name.
- Don't add a second way to reach the same result. Compose from the members above.
