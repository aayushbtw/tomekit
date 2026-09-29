---
"tomekit": minor
---

Read collections outside Vite: `node --import tomekit/register script.ts` builds your content, then sends `tomekit/content` to `.tomekit/content.js`, fully typed. It also works for imports of `tomekit/content` in `vite.config.ts`, eg to list pages to prerender, and with `bun --preload tomekit/register`.
