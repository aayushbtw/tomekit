---
title: MDX
description: Render MDX with your own components, on any server, Cloudflare Workers included.
section: Content
order: 2
---

tomekit reads an MDX file's frontmatter like any other file. Your bundler compiles the rest, and each page imports only the body it renders. Nothing is compiled or evaluated at runtime, so it works where `eval` is blocked, eg on Cloudflare Workers.

## Setup

Add MDX to Vite, with `remark-frontmatter` so the frontmatter isn't rendered as text, and wrap it in `cached` so the next build compiles only the files that changed:

```sh title="Terminal"
pnpm add -D @mdx-js/rollup remark-frontmatter @types/mdx
```

```ts title="vite.config.ts"
import mdx from "@mdx-js/rollup";
import viteReact from "@vitejs/plugin-react";
import remarkFrontmatter from "remark-frontmatter";
import { cached, tomekit } from "tomekit/vite";

export default defineConfig({
  plugins: [
    cached({ enforce: "pre", ...mdx({ remarkPlugins: [remarkFrontmatter] }) }),
    tomekit(),
    viteReact({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
  ],
});
```

Including `.mdx` in the React plugin makes an edit to a body update the page in place, keeping component state. `cached` is optional. Without it, every build compiles every file. See [Caching](#caching).

## The config

Load the `.mdx` files and return each file as the body with `fileModule`. Its type parameter is what the file exports:

```ts title="tomekit.config.ts"
import type { MDXModule } from "mdx/types";
import { defineConfig, directory, fileModule } from "tomekit";
import { z } from "zod";

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts", { files: "**/*.mdx" }),
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

## Caching

`cached` from `tomekit/vite` wraps one plugin and keeps what its `transform` returns for each file in `.tomekit/cache/plugins`. The next `vite build` or dev server reuses a file's result instead of compiling it again. The plugin's other hooks run as before.

A result is reused only while all of these stay the same:

- the file's path, and its text as the plugin receives it
- `vite.config.ts` and every local file it imports, since the plugin's options, eg remark plugins, live there
- the options passed to Vite on the command line or to `build()`, eg `--base` or `--sourcemap`
- your lockfile, so installing or upgrading a package compiles everything again
- the version of tomekit

Builds and dev, each `--mode` and each Vite environment, eg client and ssr, keep their own results, since MDX compiles differently for each. An edit to a body in dev still updates the page in place: it changes the file's text, so the file compiles again.

A build saves the results when it ends, and a failed build saves nothing. The dev server saves a second after it compiles a file, and when it stops. The first save in each build or dev server drops the results of deleted files.

### When nothing is cached

`cached` keeps nothing on disk, and says so once in the terminal, when:

- there is no lockfile from the root up, since a package upgrade would go unnoticed
- Vite runs without a config file (`configFile: false`), since nothing on disk stands in for the plugin's options
- Vite loads the config with `--configLoader native`, which doesn't report every file the config imports

A file compiles every time, also with one message, when its transform uses its plugin context for something a stored result can't repeat, eg `this.emitFile`, `this.addWatchFile` or `this.warn`, or returns a field other than `code`, `map`, `moduleType` and `moduleSideEffects`. The other files are still cached.

### What the cache can't see

The plugin's output must depend only on the file and on the code that runs. tomekit can't see:

- an environment variable your Vite config reads to build the plugin's options. Pass it through `--mode` instead, or delete `.tomekit/cache/plugins` after changing it.
- a package linked from your workspace, since the lockfile stays the same.
- a file the plugin reads itself while compiling, eg with `node:fs`.

Deleting `.tomekit` is always safe: the next build compiles everything again.

### Two MDX setups

The plugin's name picks its cache files, so two cached plugins with the same name fail at startup with `DuplicateCachedPluginError`. Give one its own name:

```ts title="vite.config.ts"
plugins: [
  cached({ enforce: "pre", ...mdx({ include: "content/docs/**" }) }),
  cached({ enforce: "pre", ...mdx({ include: "content/blog/**" }), name: "mdx-blog" }),
  tomekit(),
],
```

`cached` takes one plugin with a `transform` hook. Anything else, eg a list of plugins, throws `UncacheablePluginError`.

## Syntax errors

The bundler compiles the MDX, so a syntax error shows in Vite's overlay in dev and fails `vite build`, pointing at the file.

## Register

`tomekit/register` also sends `tomekit/content-modules` to the generated `.tomekit/content-modules.js`. A script that only reads metadata works as it is. To render a body, Node has to load `.mdx` files too, eg with `@mdx-js/node-loader`.
