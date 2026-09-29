---
"tomekit": patch
---

Dev and `tomekit watch` no longer watch folders your `!` patterns leave out, or dot folders. On Linux, a collection loaded from the project root with `"!node_modules/**"` no longer watches `node_modules`.
