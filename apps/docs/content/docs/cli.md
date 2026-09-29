---
title: CLI
description: Build or watch your collections without Vite.
section: Tools
order: 1
---

The `tomekit` command writes `.tomekit/content.js` and its types without running Vite:

```sh title="Terminal"
tomekit build   # build once; exits 1 on broken content
tomekit watch   # build, then rebuild on every change, with dev set to true
```

Both read `tomekit.config.ts` from the current folder, or the file `--config` names.

- `tomekit build` checks content in CI without a Vite build.
- For a tool that reads the `tomekit/content*` path in `tsconfig.json` but can't preload a module, run `tomekit build` or `tomekit watch` first. Node and Bun can build on their own, see [Register](/register).
