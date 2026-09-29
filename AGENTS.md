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

- `packages/tomekit` is the library. `apps/` holds the docs and bench.
- `examples/` are standalone apps on the published `tomekit`. When runtime output or generated types change, `vpr build`, copy each example to the scratchpad (inside the repo, `vpr` runs the root's scripts instead), point its `tomekit` at `file:<repo>/packages/tomekit`, and run `vp install && vpr build && vpr check`.
- Fmt and lint are Ultracite's presets, extended in the root `vite.config.ts`. Package-specific rules go in its `overrides`, since Vite+ ignores `lint` in package configs.

- User-facing behavior, including what fails at compile time, build time or not at all, is documented in `apps/docs/content/docs`, in the same change as the code.

## Guides

Read the one that applies before starting. All are in `.claude/guides/`:

- `principles.md`: before designing or recommending anything
- `naming.md`: before naming anything
- `structure.md`: before adding a file or moving code between files
- `code-style.md`: before writing code
- `errors.md`: before adding or changing an error, warning or message
- `tsdoc.md`: before adding or changing a public export or option
- `releases.md`: before committing a `fix` or `feat`, or releasing

## Internal notes

`.claude/internal/` (local, gitignored) holds decisions users don't need. Read what applies before designing:

- `architecture.md`: settled design
- `out-of-scope.md`: what tomekit doesn't do on purpose
- `experiments.md`: failed designs and measurements
- `roadmap.md`: what's next

Record a new decision there, and a new rule or name in the guides, not here.
