---
"tomekit": minor
---

**Breaking:** `collections.get("…")` and `.get("slug")` reject a literal that isn't a known name or slug, so a typo fails to compile. Strings built at runtime still work.
