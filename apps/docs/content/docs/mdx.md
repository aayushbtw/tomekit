---
title: MDX
description: Render MDX with your own components, on any server, Cloudflare Workers included.
section: Content
order: 2
---

tomekit reads an MDX file's frontmatter like any other file. Your bundler compiles the rest, and each page imports only the body it renders. Nothing is compiled or evaluated at runtime, so it works where `eval` is blocked, eg on Cloudflare Workers.

## Setup

Add MDX to Vite, with `remark-frontmatter` so the frontmatter isn't rendered as text:

```sh title="Terminal"
pnpm add -D @mdx-js/rollup remark-frontmatter @types/mdx
```

```ts title="vite.config.ts"
import mdx from "@mdx-js/rollup";
import viteReact from "@vitejs/plugin-react";
import remarkFrontmatter from "remark-frontmatter";
import { tomekit } from "tomekit/vite";

export default defineConfig({
  plugins: [
    { enforce: "pre", ...mdx({ remarkPlugins: [remarkFrontmatter] }) },
    tomekit(),
    viteReact({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
  ],
});
```

Including `.mdx` in the React plugin makes an edit to a body update the page in place, keeping component state.

## The config

Load the `.mdx` files and return each file as the body with `fileModule`. Its type parameter is what the file exports:

```ts title="tomekit.config.ts"
import type { MDXModule } from "mdx/types";
import { defineConfig, directory, fileModule } from "tomekit";
import { z } from "zod";

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts", { include: "**/*.mdx" }),
      schema: z.strictObject({ title: z.string() }),
      transform: ({ file }) => ({ body: fileModule<MDXModule>(file.path) }),
    },
  },
});
```

The document's `body` is then the file's path, eg `"content/posts/hello.mdx"`, typed as `Module<MDXModule>`. It's a string, so it passes through a server function or a loader like the rest of the document.

- `fileModule` can only be the body. Anywhere else, the build fails.
- The path is relative to the project root. A file that doesn't exist fails the build.
- `transform` can still read `body`, the MDX text, eg to collect headings into `metadata`.

## Rendering

Pass the body to `importModule` from `tomekit/content-modules`. It imports the compiled file, which the bundler puts in its own chunk, so a page loads only its own post. It holds no documents, so it's safe in browser code.

```tsx title="src/routes/posts.$slug.tsx"
import { createFileRoute } from "@tanstack/react-router";
import type { MDXModule } from "mdx/types";
import { Suspense, use } from "react";
import type { Module } from "tomekit";
import { importModule } from "tomekit/content-modules";

import { Chart } from "#/components/chart";
import { getPost } from "#/server/posts";

export const Route = createFileRoute("/posts/$slug")({
  loader: ({ params }) => getPost({ data: params.slug }),
  component: Post,
});

function Body({ body }: { body: Module<MDXModule> }) {
  const { default: Content } = use(importModule(body));

  return <Content components={{ Chart }} />;
}

function Post() {
  const { body, metadata } = Route.useLoaderData();

  return (
    <article>
      <h1>{metadata.title}</h1>
      <Suspense>
        <Body body={body} />
      </Suspense>
    </article>
  );
}
```

`getPost` is the server function from [TanStack Start](/tanstack-start). The page renders on the server, and the browser loads the same chunk to hydrate it. `importModule` returns the same promise for a body every time, so `use()` suspends only until the first import finishes.

An MDX file can also import components itself, with paths relative to the file:

```mdx title="content/posts/hello.mdx"
---
title: Hello
---

import { Chart } from "../../src/components/chart";

<Chart />
```

## Syntax errors

The bundler compiles the MDX, so a syntax error shows in Vite's overlay in dev and fails `vite build`, pointing at the file.

## Register

`tomekit/register` also sends `tomekit/content-modules` to the generated `.tomekit/content-modules.js`. A script that only reads metadata works as it is. To render a body, Node has to load `.mdx` files too, eg with `@mdx-js/node-loader`.
