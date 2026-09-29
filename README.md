# tomekit

Fully typed content collections for Markdown and MDX.

Import your Markdown as typed data. Every file is parsed and validated at build time, so nothing parses at runtime. [Read the docs](https://tomekit.aayush.cv).

## Why tomekit

- **Type safe.** Collections, slugs and metadata are typed, so `posts.get("hello-wrld")` doesn't compile.
- **Fast.** Parsed once at build time, transforms cached, and pages ship only the collections they import.
- **Strict.** Broken content and broken references fail the build, each at its `file:line:column`.
- **Runs anywhere.** Your bundler compiles MDX, so there's no `eval`, Cloudflare Workers included.

## Quick start

```sh
pnpm add tomekit zod
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

**4. Write a post** in `content/posts/hello-world.md`:

```md
---
title: Hello world
---

The first post.
```

**5. Read it** from server code:

```ts
import { posts } from "tomekit/content";

const post = posts.get("hello-world");

post.metadata.title; // "Hello world"
post.body; // "The first post."
```

To render the body, see [Transform](https://tomekit.aayush.cv/transform) and [MDX](https://tomekit.aayush.cv/mdx).

## Examples

- TanStack Start: [guide](https://tomekit.aayush.cv/tanstack-start), [StackBlitz](https://stackblitz.com/github/aayushbtw/tomekit/tree/main/examples/tanstack-start)
- React Router: [guide](https://tomekit.aayush.cv/react-router), [StackBlitz](https://stackblitz.com/github/aayushbtw/tomekit/tree/main/examples/react-router)
- SolidStart: [guide](https://tomekit.aayush.cv/solid-start), [StackBlitz](https://stackblitz.com/github/aayushbtw/tomekit/tree/main/examples/solid-start)

## AI agents

The package ships a guide for coding agents, matching the installed version. Set it up with one prompt, or point your `AGENTS.md` at it by hand, see the [Quick start](https://tomekit.aayush.cv).

## Requirements

Vite 8, TypeScript 7 and Node 24, or later.

## Credits

The docs site's design is based on [Audio](https://audio.raphaelsalaja.com) by [Raphael Salaja](https://github.com/raphaelsalaja).

## License

MIT
