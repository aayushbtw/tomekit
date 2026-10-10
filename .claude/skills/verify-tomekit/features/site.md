# Site build and dev

The `tomekit()` Vite plugin builds content while the app's dev server or build runs, and pages read it from `tomekit/content`.

## Sub-features

- dev-serve: a post page renders its metadata and HTML body.
- dev-reload: editing a Markdown file updates the page without a restart.
- dev-broken: a broken file is logged and left out; every other page keeps serving.

## How to get to it (user POV)

Add `tomekit()` to `plugins` in `vite.config.ts`, before the framework plugin, then run the app's dev command. Documented in `getting-started.md`, `tanstack-start.md`, `react-router.md` and `solid-start.md`.

## Driving it

Preconditions: a scratch dir `D`. Run `node $S dev start $D` and keep its `url` as `U`.

- Serve: `node $S dev fetch $U/posts/hello-world --label page-before`. Pass when `status` is 200 and `h1` is `Hello world`.
- Reload: change `title: Hello world` to `title: Hello edited` in `$D/content/posts/hello-world.md`, wait 3s, fetch again. Pass when `h1` is `Hello edited`.
- Broken in dev: write `$D/content/posts/broken.md` with `title: 42`, wait 3s, fetch `$U/posts/known-slugs`. Pass when `status` is 200, and the dev log (the `log` path from `dev start`) has `content/posts/broken.md:2:1: title:`.
- Other frameworks: same recipe on `scratch react-router` (home page `h1` is `Posts`) or `scratch solid-start`.

## Gotchas

- `dev start` waits up to 60s for the first answer. A failure names the log to read.
- The react-router example starts through `react-router dev`; the others through `vite dev`. The script picks the right one.
- `dev fetch` reads the server-rendered HTML. It doesn't run client JavaScript, so it can't prove client-only behavior.
