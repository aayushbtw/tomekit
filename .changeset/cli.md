---
"tomekit": minor
---

Add the `tomekit` command. `tomekit build` writes `.tomekit/content.js` and its types once and exits 1 on broken content, eg to check content in CI. `tomekit watch` rebuilds them on every change. Both take `--config`.
