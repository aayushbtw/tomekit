---
title: AI agents
description: Point coding agents at the docs for the version you installed.
section: Tools
order: 4
---

The `tomekit` package ships a guide for coding agents, eg Claude Code, Codex or Cursor. It matches the version you installed, so an agent reads it instead of guessing from older code it has seen.

Add this to `AGENTS.md` at your project root:

```md title="AGENTS.md"
## tomekit

This project uses tomekit for content. Before writing code that touches `tomekit.config.ts` or imports from `tomekit`, read `node_modules/tomekit/dist/AGENTS.md` completely, and follow its links when needed.
```

In a monorepo, write the path from the root to the app that depends on tomekit, eg `apps/web/node_modules/tomekit/dist/AGENTS.md`.

The guide covers setup, reading, transforms, loaders, MDX and the mistakes agents most often make. For anything else it points the agent at the TSDoc and examples on every export, which ship in the same folder.
