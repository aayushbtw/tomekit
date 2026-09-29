---
"tomekit": patch
---

`vite build` is about 6% faster: it no longer hashes each entry for a rebuild that never comes. Dev and `vite build --watch` still do.
