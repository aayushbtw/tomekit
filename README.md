# tomekit

Fully typed content collections for Markdown.

## Support

Vite 8+, TypeScript 7+ and Node 24+.

## Quick start

```sh
pnpm add tomekit
```

**1. Define a collection** in `tomekit.config.ts`:

```ts
import { defineConfig, directory } from "tomekit";
import { z } from "zod";

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts"),
      schema: z.strictObject({ title: z.string() }),
    },
  },
});
```

**2. Add the plugin** to `vite.config.ts`:

```ts
import { tomekit } from "tomekit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tomekit()],
});
```

**3. Add the types path** to `tsconfig.json`, and `.tomekit` to `.gitignore`:

```json
{
  "compilerOptions": {
    "paths": { "tomekit/content*": ["./.tomekit/content*"] }
  }
}
```

**4. Read your content:**

```ts
import { posts } from "tomekit/content";

const post = posts.get("hello-world");

post.metadata.title; // string
post.body; // the Markdown
```

## Examples

A small blog per framework, each one opens in StackBlitz:

- [TanStack Start](https://stackblitz.com/github/aayushbtw/tomekit/tree/main/examples/tanstack-start)
- [React Router](https://stackblitz.com/github/aayushbtw/tomekit/tree/main/examples/react-router)
- [SolidStart](https://stackblitz.com/github/aayushbtw/tomekit/tree/main/examples/solid-start)

## License

MIT
