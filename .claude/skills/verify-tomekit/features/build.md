# Build content

The `tomekit` command parses and validates every collection and writes `.tomekit/content.js` and its types, without Vite.

## Sub-features

- build: `tomekit build` builds once. Exit 0 on success.
- broken-content: exit 1, every broken file listed as `file:line:column: field: message`.
- watch: `tomekit watch` builds, then rebuilds on every change.
- config-flag: `--config <file>` reads another config file.

## How to get to it (user POV)

In a project with `tomekit.config.ts`, run `tomekit build` or `tomekit watch`. Documented in `apps/docs/content/docs/cli.md` and `errors.md`.

## Driving it

Preconditions: a scratch dir `D` from `node $S scratch tanstack-start`.

- Build: `node $S run $D --label cli-build -- node_modules/.bin/tomekit build`. Pass when `exit` is 0, stdout has `built .tomekit/content.js`, and `$D/.tomekit` has `content.js` and `content.d.ts`.
- Broken content: write `$D/content/posts/broken.md` with `title: 42` in its frontmatter, then build again. Pass when `exit` is 1 and stderr has `content/posts/broken.md:2:1: title: Invalid input: expected string, received number`. Delete the file after.
- Config flag: `cp $D/tomekit.config.ts $D/other.config.ts`, then `node $S run $D -- node_modules/.bin/tomekit build --config other.config.ts`. Pass when `exit` is 0. Delete the copy after.
- Watch: `node $S run $D --label cli-watch --timeout 5000 -- node_modules/.bin/tomekit watch`. Pass when `signal` is `SIGTERM` (the timeout stopped it) and stdout has `built .tomekit/content.js`.

## Gotchas

- `run` records a non-zero exit as evidence; the control script itself still exits 0.
- `watch` never exits, so always give it `--timeout`. This proves the first build only. Rebuilding on change is proven through the dev server, in [site.md](./site.md).
