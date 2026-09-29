---
"tomekit": minor
---

Builds are about 15% faster and output about 8% smaller: each collection is generated as one `JSON.parse`, and plain JSON data is serialized natively.

**Breaking:** `document.file` is now `{ path }`. `file.name` is gone; use `path.basename(document.file.path)`.
