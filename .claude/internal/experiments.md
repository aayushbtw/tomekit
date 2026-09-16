# Experiments

Designs that were tried and failed, and measurements behind a decision, so nobody retries them. Add one whenever a tested design is dropped.

## Types

- **Type-level "is serializable" check on transform output:** fails on recursive AST types. Checked at runtime instead.
- **Checking a loader's metadata type against the schema's input** (2026-09-15): (1) two more intersected mapped types in `defineConfig` broke `schema` inference for every collection; (2) folding the check into the existing `loader` member never fired; (3) a check in `defineCollection` alone caught typed and inline mismatches and allowed `z.coerce`, but rejected `JSON.parse` metadata (an `any` guard did not help), put the error on `schema` with an intersection type, and left `defineConfig` collections unchecked.
- **`transform` as a function property with a deferred conditional on the file type:** the file type stayed invariant.
- **A conditional on the slug type instead of a separate known-slug parameter on `Collection`:** breaks assigning a collection with known slugs to a helper typed `Collection<T>`.
- **Rejecting unknown literals in `get()`** (2026-09-16): typing the argument as `TKey & known` works, but the error says `never` instead of the valid keys. Treating any non-`string` key as a literal broke template literals, eg `` `${slug}/${kind}` ``.
- **Typing `source` with slug types for referenced fields:** compiled (tsconfig `paths` reach `node_modules`) but would claim slugs the reference check hasn't run on.
- **Editor suggestions inside a transform's returned object:** removing `then` broke async suggestions or types in every shape, and `NoInfer<TransformResult>` in the return type gives no suggestions while the output is still being inferred.
- **Constraining `defineConfig`'s inline transform output**, even with `PromiseLike` and the symbol-keyed `Skipped`: loses every inline transform's output type through the two intersected mapped types. Tested twice.

## Config

- **References on each collection instead of the top level** (2026-09-15): checking paths and names lost every transform's output type, whether as an intersection, inside `NoInfer`, or as a constraint on the generic.
- **`watch` as a field on the loader** (2026-09-15): a flat field let one loader's `!` pattern hide another's files once a loader called another's `load`. Nested arrays fix it but leave the grouping to wire up by hand. Astro's raw `watcher` was rejected too: without a store a change can only rerun `load`, and it ties loaders to Vite.

## Content checks

- **Flagging frontmatter keys missing from the schema's output** (2026-09-16): breaks on an undeclared `slug` and on schemas that rename or reshape keys.
- **Failing the build when a folder has files but none match `include`** (2026-09-16): rejected by the user; it warns with the count of other files instead.

## Docs and tests

- **Documenting what fails, and when** (2026-09-16): a hand-written table in `errors.md`, then TSDoc problem tags (`@typeError`, `@buildError`, `@warning`, `@notCaught`) that generated the table, with `catches.test.ts` pinning every tag to a real build and `tsc` run. Dropped: each new check needed a tag in up to 3 places plus a case, the test pinned docs wording rather than behavior, and all 35 cases duplicated module tests. Type and build errors already name the problem and fix, and warnings state their consequence, so they need no docs. What nothing reports is documented where the choice is made (strict schemas in `collections.md`, `get()` returning `undefined` in `reading.md`).
- **Snapshotting error output into docs:** rejected before building. Snapshots record what happens, not what should, so a silently accepted mistake looks as green as a caught one.

## Measurements

- **`directory()` full reload** (2026-09-15): ~80 ms for 1,000 files, ~710 ms for 10,000. Transforms are already skipped by hash.
- **`assertContentValue` vs `serialize`:** the check costs about 2/3 of serialize time, a few ms per build.
