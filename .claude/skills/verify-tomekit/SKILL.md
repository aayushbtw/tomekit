---
name: verify-tomekit
description: Prove a tomekit change works the way a user sees it, by building a real consumer project against the local package and driving its CLI, types and dev server. Use before calling a change to packages/tomekit done.
---

# Verify tomekit

tomekit is a library, so the user is a project that installs it. Verify by copying an example from `examples/` outside the repo, pointing its `tomekit` at the local `packages/tomekit`, and using it as that project would.

All commands below run from the repo root. `S` is the control script:

```sh
S=.claude/skills/verify-tomekit/control.ts
node $S --help
```

Every command prints JSON. The script is linted and type-checked by `vpr check` like the rest of the repo. Evidence is saved under the `evidence` dir in the working root (`$TMPDIR/verify-tomekit`, or `VERIFY_TOMEKIT_ROOT`).

## Launch

1. `vpr build` in the repo root, so `packages/tomekit/dist` matches `src`.
2. `node $S doctor`. Stop and fix anything it reports before driving.
3. `node $S scratch <example>` prints `dir`, a fresh copy linked to the local package and installed (about 6s). Examples: `tanstack-start`, `react-router`, `solid-start`. Use `tanstack-start` unless the change is framework-specific.

Each `scratch` is a new dir and each dev server picks its own free port. `cleanup` clears everything under the working root, so two sessions running at once each set their own `VERIFY_TOMEKIT_ROOT`.

## Doctor

`node $S doctor` checks node 24+, `vp` on PATH, that `dist` exists and is newer than `src`. Run it first, and again after anything surprising. After changing `src`, rebuild and run `scratch` again. An existing scratch dir keeps a copy of the old `dist`.

## Drive

- CLI or build output: `node $S run <dir> --label <name> -- node_modules/.bin/tomekit build`. Records stdout, stderr and exit code.
- Types: `node $S run <dir> -- node_modules/.bin/tsc --noEmit`.
- Running site: `node $S dev start <dir>` prints `url` and `port`. Then `node $S dev fetch <url>/posts/hello-world` saves the HTML and prints `status`, `title` and `h1`.
- Content and config: edit files in the scratch dir directly. Never edit `examples/` for a test.

The feature map in [features/README.md](features/README.md) has the exact recipe for each user-facing feature. A change that touches a feature is verified through every entry point that feature lists.

## Proof

- Use the real user path: the `tomekit` bin, `tsc`, the Vite dev server. No internal imports or test-only hooks.
- Capture the action and its result: the content or code you changed, then the output that shows the effect.
- Check side effects as well as output: `.tomekit/content.js` and its `.d.ts` exist, the page shows the new data.
- Report the evidence paths. Cleanup never deletes evidence.

## Cleanup

`node $S cleanup` stops every dev server this script started and deletes scratch dirs. It keeps `evidence`, which includes each dev server's log. Add `--dry-run` to see what it would remove. `node $S dev stop <port>` stops one server.
