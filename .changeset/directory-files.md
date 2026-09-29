---
"tomekit": minor
---

**Breaking:** `directory()` takes one `files` list of globs instead of `include` and `exclude`. Start a pattern with `!` to leave files out, the same way `watch()` does: `directory("content/posts", { exclude: "drafts/**" })` becomes `directory("content/posts", { files: ["**/*.md", "!drafts/**"] })`. A `!` pattern leaves files out wherever it sits in the list.
