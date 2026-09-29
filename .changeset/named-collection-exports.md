---
"tomekit": minor
---

Import each collection by its config name: `import { posts } from "tomekit/content"`, then `posts.get("hello-world")`, fully typed like before. A module bundles only the collections it imports. `collections` stays for names known only at runtime, eg a route param.

**Breaking:** a collection can't be named `collections` or a JavaScript reserved word, eg `default`, since it's exported under its name.
