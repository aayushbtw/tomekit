# tomekit

Fully typed content collections for Markdown. Content is parsed and validated at build time and served as generated modules, so nothing is parsed at runtime.

## Commands

Vite+ monorepo: `vp` and `vpx`, never `pnpm`, `npm` or `npx`. Prefer Vite+ built-ins (`vp create`, `vp run`, `pack` options) over custom scripts.

```sh
vpr check   # format + lint + typecheck; `vpr fix` autofixes
vpr test    # vitest in every package
vpr build   # every package
```

Run `check` and `test` before calling a change done.

- `packages/tomekit` is the library; paths below are relative to it. `apps/` holds the docs and bench.
- `examples/` are standalone apps on the published `tomekit`. When runtime output or generated types change, `vpr build`, point each one's `tomekit` at `file:../../packages/tomekit`, run `vp install && vpr build && vpr check`, then restore its `package.json` and delete the lockfile and `node_modules` it created.
- Fmt and lint config lives in the root `vite.config.ts`; package-specific lint rules go in its `overrides`, since Vite+ ignores `lint` in package configs.

## Structure

Pure modules, one class that owns state, and a thin adapter, each in its own files.

| Layer | Files | Rule |
| --- | --- | --- |
| Public types + config | `index.ts` | Types, `define*` helpers and the error classes. No IO |
| Runtime | `query.ts`, `import-module.ts`, `content.ts`, `content-modules.ts` | Ships to users' servers. Keep it tiny |
| Pure core | `errors/` (one class per file), `value.ts` (`ContentValue` and its checks), `module.ts` (`fileModule` bodies), `config.ts` (config checks), `parse.ts` (a Markdown file into an entry), `validate.ts` (an entry through the schema), `document.ts` (a source plus a transform result), `serialize.ts`, `generate.ts` (source strings) | No disk, no Vite, no state. Input in, result out |
| IO per collection | `directory.ts` (the built-in loader), `collection.ts` | `directory.ts` reads files into entries. `collection.ts` runs a loader, validates and transforms, and returns `{ documents, errors, warnings }` |
| State | `builder.ts` (`ContentBuilder`) | Owns config, per-collection results and caches, and the in-flight build. Knows nothing about how errors are shown |
| Adapter | `vite.ts` | Maps Vite hooks to loader calls and reports results. No content logic |

- New logic goes into the lowest layer that can hold it.
- Split a file when it takes on a second concern, not when it gets long.
- State lives in a class with `#private` fields, not in `let`s inside a closure.
- One explicit `export { ... }` list at the bottom of each file. No `export *` barrels.
- One test file per source module in `test/` (`collection.ts` → `collection.test.ts`). Type-level tests go in `<module>.test-d.ts`, which `vpr check` type-checks and Vitest never runs.

## Read when relevant

- `.agents/errors.md`: before adding or changing an error, warning or message
- `.agents/tsdoc.md`: before adding or changing a public export or option
- `.agents/code-style.md`: before writing code in `src/` or `test/`. Anti-slop lint rules are never turned off or suppressed; change the code

## Internal notes

User-facing behavior, including what fails at compile time, build time or not at all, is documented in `apps/docs/content/docs`, updated in the same change as the code. `.claude/internal/` holds only what users don't need. Read it before designing, naming or recommending anything:

- `principles.md`: how to decide
- `naming.md`: one word per concept
- `architecture.md`: settled design
- `out-of-scope.md`: what tomekit doesn't do on purpose
- `experiments.md`: failed designs and measurements

Record a new rule, decision or name there, not here.
