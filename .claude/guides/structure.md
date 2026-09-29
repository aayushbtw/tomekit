# Structure

Paths are relative to `packages/tomekit/src`.

| Layer | Files | Rule |
| --- | --- | --- |
| Public types + config | `index.ts` | Types, `define*` helpers and the error classes. No IO |
| Runtime | `query.ts`, `import-module.ts`, `content.ts`, `content-modules.ts` | Ships to users' servers. Keep it tiny |
| Pure core | `errors/` (one class per file), `value.ts` (`ContentValue` and its checks), `skipped.ts`, `module.ts` (`fileModule` bodies), `config.ts` (config checks), `parse.ts` (a Markdown file into an entry), `validate.ts` (an entry through the schema), `document.ts` (a source plus a transform result), `reference.ts` (reference checks), `serialize.ts`, `generate.ts` (source strings), `profile.ts` | No disk, no Vite, no state. Input in, result out |
| IO | `directory.ts` (the built-in loader), `collection.ts`, `cache.ts` (transform cache on disk), `watcher.ts` (`FileWatcher`) | `collection.ts` runs a loader, validates and transforms, and returns `{ documents, errors, warnings }` |
| State | `builder.ts` (`ContentBuilder`) | Owns config, per-collection results and caches, and the in-flight build. Knows nothing about how errors are shown |
| Adapters | `vite.ts`, `cli.ts` (+ `bin.ts`), `register.ts` (+ `hooks.ts`) | Drive a `ContentBuilder` and report results. No content logic |

- New logic goes into the lowest layer that can hold it.
- Split a file when it takes on a second concern, not when it gets long.
- State lives in a class with `#private` fields, not in `let`s inside a closure.
- One explicit `export { ... }` list at the bottom of each file. No `export *` barrels.
- One test file per source module in `packages/tomekit/test/` (`collection.ts` → `collection.test.ts`). Type-level tests go in `<module>.test-d.ts`, which `vpr check` type-checks and Vitest never runs.
- Tests never rely on a built `dist`: CI runs them without one.
