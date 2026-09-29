---
"tomekit": minor
---

Every build now writes the generated module to `.tomekit/content.js`, next to its types. The file imports nothing, and it's replaced whole, so a reader never sees half of it.

**Breaking:** the plugin's `types` option is removed. Generated files always go to `.tomekit`.
