# Out of scope

What tomekit doesn't do on purpose, and why. Reopen one only when it blocks the best API (see `principles.md`).

## Codebase

- No Effect or other FP framework: a large dependency for a one-dependency library. Use the layering in `CLAUDE.md` instead.
- No singletons or `getInstance`, and no class around the Vite plugin.
- No `Register`-style module augmentation for the generated types.

## Content

- YAML only. No JSON support of any kind until the user says so (2026-09-15: YAML is the standard, JSON would help about 1% of users).
- `directory()` is the only built-in loader. No array of loaders: to mix sources, call `directory(...).load(context)` inside your own `load`.
- No push-style store, `meta` or `digest`, no schemas or types from loaders, no `renderMarkdown`, no loading at request time.
- No store for reloading one entry at a time. A full reload is fast enough (see `experiments.md`). If large folders ever matter, cache by mtime inside `directory()`, with no API change.
- No `sources()` or `documents()` on the transform context: it would give a second, different answer to whether a document exists (sources before `skip()`), and a second way to join. Joins happen at read time.

## Reading API

- One API for reading: `import { collections } from "tomekit/content"`. No `content.posts`, no per-collection modules, no named imports, no loose helpers.
- No generic `all`, `keys` or `values`: `all` meant different things at different levels.
- No "every document" member on `collections`. Combine `names()` and `get()`.
- No `getCollection(name)` function: `collections.get(name)` is the same call on the one object.
- No sort option: `documents()` stays in loader order and users call `toSorted`.
- No `.metadata()` / `.body()` accessors: documents are plain data, and `const { body, ...rest } = document` already splits them.
- No `Posts` / `PostsSlug` / `AnyDocument` / `EntryOf` / `MetadataOf` types, and no type named `Document`, which shadows the browser's global.
- No `Transform` function type: a shared transform is a generic function declaration, which a type alias cannot annotate. Type its parameter as `Source<TMetadata>`.
