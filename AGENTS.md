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

## Errors

- **Return problems, don't throw them.** Lower layers return results (`{ document } | { issues }`, `{ entries, errors }`). Only the adapter decides: `vite build` throws, dev logs the errors, shows them in the overlay and serves the files that work.
- **Collect, don't stop.** Report every broken file in one pass.
- **Point at the source.** A content problem is a `ContentError` printed as `file:line:column: message`, with `file` relative to the root. When a key is missing, point at the deepest parent that exists. With no frontmatter at all, leave line and column out.
- **Messages name the fix**: ``transform returned "url", but it can only return `metadata` and `body`. Put derived values inside `metadata` instead``.
- **Warnings state the consequence**: `directory "x" has no files, so the collection is empty`.
- Only the adapter adds the `[tomekit]` prefix and talks to the logger.
- **Every thrown error is a class in `src/errors/`**, one per file, exported from `src/errors/index.ts`. No `throw new Error(...)` in `src/`. Classes extend a category (`ConfigError`, `ContentError`, `TransformError`, `PluginError`), which extends `TomekitError`. Each sets `name` explicitly, and its constructor takes data and builds the message. Add a class per distinct failure, not per call site. Wrapped errors go in `cause`.

## TSDoc

Everything users import from `tomekit`, `tomekit/content`, `tomekit/content-modules` and `tomekit/vite`, plus each option field, gets a one-sentence summary, then an `@example` that runs as written, with results in trailing comments.

````ts
/**
 * The document with this slug.
 *
 * @example
 * ```ts
 * posts.get("hello-world").metadata.title // "Hello world"
 * ```
 */
````

- `@param` / `@returns` only when they say something the name and type don't.
- Internal functions get no TSDoc unless they have a contract the types can't express.

## Code style

Lint is oxlint with anti-slop (vendored in `tools/oxlint/anti-slop/`) and a short explicit rule list in the root `vite.config.ts`, no preset. Anti-slop always wins:

- Never turn off, loosen or suppress an anti-slop rule. Change the code.
- When another rule conflicts with anti-slop, turn that rule off in the root `vite.config.ts` with a one-line reason.
- Add a rule when it would have caught a real problem, not because a preset has it.
- Unknown input is checked once at its boundary with an assertion or type predicate (eg `assertContentValue`), then handled as a named type. No `typeof`; tell primitives apart by boxing them (`new Object(value) instanceof Number`).
- A parameter typed `unknown` is only allowed when it is named `cause` or is a type predicate's subject.

Also enforced by lint, so write them up front: `interface` for object shapes (`type` only for unions, function, mapped and conditional types), function declarations over arrow consts, `async`/`await` over `.then`, sorted object keys, no `any` or unsafe assertions (in tests too).

- Types inferred from user schemas are wrapped once in `Prettify`, so errors print flat fields. Use `PrettifyIfPlainObject` where a value might be an array or a built-in (Date, Map, Set, RegExp). Don't generate named interfaces to work around this.
- Helper types that exist only for generated code or the type system get `@internal`.
- Options objects with defaults go in the signature: `function tomekit({ config = "tomekit.config.ts" }: TomekitOptions = {})`.

## Internal notes

User-facing behavior, including what fails at compile time, build time or not at all, is documented in `apps/docs/content/docs`, updated in the same change as the code. `.claude/internal/` holds only what users don't need. Read it before designing, naming or recommending anything:

- `principles.md`: how to decide
- `naming.md`: one word per concept
- `architecture.md`: settled design
- `out-of-scope.md`: what tomekit doesn't do on purpose
- `experiments.md`: failed designs and measurements

Record a new rule, decision or name there, not here.
