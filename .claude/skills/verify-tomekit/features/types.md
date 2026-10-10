# Typed reads

`import { posts } from "tomekit/content"` is fully typed: collection names come from the config, slugs from the files, and metadata from the schema.

## Sub-features

- slug-check: `posts.get("typo")` is a type error that lists the real slugs.
- metadata-types: `post.metadata` matches the schema's output, eg `publishedAt` is a `Date` after `z.coerce.date()`.

## How to get to it (user POV)

Add `"tomekit/content*": ["./.tomekit/content*"]` to `tsconfig.json` paths, build once, then import from `tomekit/content`. Documented in `getting-started.md` and `reading.md`.

## Driving it

Preconditions: a `tanstack-start` scratch dir `D` that has been built once (`tomekit build`). The react-router example needs `react-router typegen` before `tsc`, and keeps its code in `app/`, not `src/`.

- Clean project: `node $S run $D --label typecheck -- node_modules/.bin/tsc --noEmit`. Pass when `exit` is 0.
- Slug typo: write `$D/src/typo.ts` with `import { posts } from "tomekit/content"; export const p = posts.get("no-such-post");`, then run `tsc` again. Pass when `exit` is 1 and stdout says `"no-such-post"` is not assignable to `"hello-world" | "known-slugs" | "typed-frontmatter"`. Delete the file after.

## Gotchas

- Types come from `.tomekit/content.d.ts`. Without a build first, every import from `tomekit/content` fails to resolve, which looks like a types bug but isn't.