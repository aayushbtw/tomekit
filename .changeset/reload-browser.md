---
"tomekit": patch
---

In dev, a content change now reloads the browser when only server code imports `tomekit/content`, eg from a TanStack Start server function. Before, the page kept showing the old content until you reloaded it.
