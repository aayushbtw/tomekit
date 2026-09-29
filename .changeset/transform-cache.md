---
"tomekit": minor
---

`transform` results are now cached in `.tomekit/cache`, so a new `vite build`, dev server, `tomekit build` or `tomekit/register` run calls `transform` only for entries that changed. A warm build of 1,000 Markdown files rendered with `marked` is about 30% faster. The cache is thrown away when the config, a file it imports, the lockfile or tomekit changes, so a transform must depend only on its arguments: read anything else in a loader. See the Transform page's Caching section.
