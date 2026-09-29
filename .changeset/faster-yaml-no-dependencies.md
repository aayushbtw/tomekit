---
"tomekit": patch
---

Frontmatter parses about 8x faster, and tomekit installs with no dependencies: it now reads YAML with a bundled js-yaml instead of `yaml`. YAML syntax errors point at the same place, with different wording.
