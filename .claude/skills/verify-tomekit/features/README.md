# tomekit feature map

What a project using tomekit can do, and how to prove each one works. Read this before driving, then use the matching file as the recipe.

## Baseline

- `vpr build` in the repo root, then `node $S doctor` passes.
- A fresh `node $S scratch tanstack-start`. Its `content/posts` has `hello-world.md`, `known-slugs.md` and `typed-frontmatter.md`. Its schema requires `title`, `description` and `publishedAt`.
- `S=.claude/skills/verify-tomekit/control.ts`, run from the repo root.

## Features

- [Build content](./build.md): the `tomekit build` CLI writes the generated module and types, and fails with `file:line:column` on broken content.
- [Typed reads](./types.md): collection names and slugs are checked by TypeScript.
- [Site build and dev](./site.md): the Vite plugin serves content to a real framework app, and dev picks up edits.

User docs for all of these live in `apps/docs/content/docs`. When a doc and this map disagree, check the code and fix whichever is wrong.
