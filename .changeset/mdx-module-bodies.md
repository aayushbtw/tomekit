---
"tomekit": minor
---

Render MDX, compiled by your bundler, on any server, including Cloudflare Workers. Return `fileModule<MDXModule>(file.path)` as the body in `transform`: the document's `body` becomes the file's path, typed as `Module<MDXModule>`, so it passes through server functions. Render it with `importModule` from the new `tomekit/content-modules`, which lazily imports each body as its own chunk. In dev, an edit that changes only a body no longer reloads the page, so your bundler's hot update keeps component state.
