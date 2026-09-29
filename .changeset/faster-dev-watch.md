---
"tomekit": patch
---

Dev reloads after a content change are about twice as fast on macOS. The plugin now watches content with `fs.watch`, since Vite's watcher reports changes there about 100 ms late.
