# Architecture

Settled design that users don't see directly. Each one was argued; reopen it only when it blocks the best API (see `principles.md`), and update it here in the same change. What users can see, eg what fails at compile time or build time, lives in the docs site.

## Codebase

- Each plugin instance gets its own `ContentBuilder`. The state class is `ContentBuilder`, so "loader" means only `loader`.
- Minimum Vite is 8 and TypeScript is 7 only. Prefer current APIs over deprecated ones, and don't work around TS 5 or 6 behavior, eg the empty `*` match in `"tomekit/content*"` paths.
- Tests never rely on a built `dist`: CI runs them without one.
- `package.json` does not export `tomekit/query`, so users can't reach `createCollection`.
- `Skipped` is exported as a type only; `skip()` is the one way to make one.

## Generated files

- Generated files stay in `.tomekit/`, never in `src/` or the root.
- All generated types go in one `.tomekit/content.d.ts`.

## Documents

- Metadata is nested under `metadata`, so a schema field can never clash with a field tomekit sets.
- `slug` is read from the raw frontmatter, since a schema may strip undeclared keys. Anything but a non-empty string is a content error, never a fallback to the path, so a build can't ship a wrong URL.
- Unknown frontmatter keys are the schema's call. Docs and examples use `z.strictObject`, so a typo fails the build.
- `transform` can't change `slug` or `file` or add top-level fields, so every collection's documents keep one shape.

## Loaders

- Why loaders: content from code, eg a `.d.ts`, a CMS or an API, gets the schema, types and build-time checks without being written to disk first. The site's API reference was the first case.
- Reading files is the built-in `directory()`, not a special path, so there is one way to do it.
- `load` always returns `{ entries, issues?, warnings? }`. Problems are returned; a throw fails only that collection.
- tomekit hashes each entry itself to skip unchanged transforms.
- `watch` is a call on `LoadContext`, not a field on the loader.
- `directory()` on a missing folder is a content error, since a wrong path would ship an empty collection. A folder with no matching files only warns, since a collection can be empty on purpose.
- `Entry.metadata` stays `object`; the schema checks it at build time.

## References

- Declared at the top level of the config, which sees every collection name. A `defineCollection` in its own file never can.
- A slug resolves only to a document `get()` returns. A document with a slug that doesn't resolve is left out like any broken one, repeated until nothing changes, so the generated slug types hold in dev too.
- Checked on the final documents, after `transform`: a target's `skip()` decides which slugs exist, and collections can point at each other. So `source` keeps `string` for referenced fields; only documents get slug types.
- Only strings at a path are checked, so a transform can replace a slug with an object.

## API

- Reading members are methods named after what they return, like `Map`. See `naming.md`.
- `get` at both levels: a known key returns the value, an unknown literal doesn't compile and names the valid keys, a plain `string` or template literal returns `| undefined`. Without known keys (a union of names, a `Collection<T>` helper), any literal is allowed.
- `Collection` has a separate known-slug type parameter (default `never`) for `get`'s first overload, so a collection with known slugs still fits a helper typed `Collection<T>`.
- One generic type per concept (`CollectionName`, `DocumentOf`, `SlugOf`), the name optional to mean any collection. `InferDocument` is `@internal`.
- Export building blocks, not features: a named type for every shape users write or receive, and a member only where users would otherwise rewrite the same logic.

## Validation

- Transform output is checked at runtime in `value.ts` (`assertContentValue`), which reports the key path.
- Content is walked twice, by `assertContentValue` and then `serialize`. The check costs about 2/3 of serialize time, a few ms per build. Keep them separate; merging would mix two concerns.

## Errors

- Every error class is exported from `tomekit` in an explicit list, so users check `instanceof` instead of matching `name`.
- Error classes get a one-line summary each. The single `@example` lives on `TomekitError`.

## Prior art

- Astro's content layer (`withastro/astro` `c2e6b0d`, checked 2026-09-15): taken the loader as the base, an optional file per entry, and loaders saying what they watch. Skipped `store`, `meta` and `digest` (incremental syncs from large remote sources), reporting by throwing or logging, schemas from loaders (types would have two sources) and live collections (parse at request time).
- Astro's `reference()` only logs a missing entry, and the build passes. content-collections has no reference check, and its `context.documents()` types transformed documents as schema output. tomekit fails the build.
- content-collections rereads only the changed file but still rebuilds everything.
