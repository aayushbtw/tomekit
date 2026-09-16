---
title: Errors
description: How problems in content and config are reported.
section: Concepts
order: 4
---

tomekit reports every broken file in one pass, pointing at where to fix it.

## When a problem is caught

- **Type error:** TypeScript flags it in your editor and `tsc`.
- **Build error:** `vite build` fails. The dev server shows it in the overlay and keeps serving the rest.
- **Warning:** logged. Nothing stops.
- **Not caught:** nothing tells you, so check it yourself.

| Problem | Caught |
| --- | --- |
| A collection name in code that isn't in the config, eg `collections.get("postz")` | Type error |
| A slug in code that no file has, eg `posts.get("helo-world")` | Type error |
| A slug from a plain string, eg `posts.get(params.slug)`, that no file has | Not caught: returns `undefined` |
| A field that doesn't exist on `metadata` | Type error |
| A `schema` that doesn't produce an object | Type error |
| A `references` entry naming a collection or path that doesn't exist, or a path that doesn't hold strings | Type error |
| A `transform` in `defineCollection` returning a top-level field other than `metadata` or `body` | Type error |
| The same mistake in a `transform` written inline in `defineConfig` | Build error |
| A `transform` returning something that isn't data, eg a function | Build error |
| YAML that doesn't parse, or frontmatter that isn't keys and values | Build error |
| Frontmatter that fails the schema, eg a missing `title` | Build error |
| A misspelled frontmatter key | Build error with a strict schema, eg `z.strictObject`. Not caught with `z.object`, which drops it |
| A `slug` in frontmatter that isn't a non-empty string | Build error |
| Two documents with the same slug | Build error |
| A reference to a slug that doesn't exist, or to a skipped or broken document | Build error |
| A `directory()` folder that doesn't exist | Build error |
| A loader that throws, or returns `issues` | Build error |
| A collection without a `loader` or `schema` | Type error, and a build error in a JavaScript config |
| A config that doesn't load or has no default export | Build error |
| A collection name that isn't letters, digits and `_`, starting with a letter | Build error |
| A `directory()` folder with no files, or none matching `include` | Warning |
| A `tsconfig.json` that doesn't map `tomekit/content` | Warning |

## Content errors

A problem in a document is printed as `file:line:column: message`, with the file relative to the project root.

```
content/posts/hello.md:2:1: title: Invalid input: expected string, received undefined
content/posts/typo.md:2:1: author: no document in collection "authors" has the slug "adaa". Fix the slug, or add a document with it to "authors"
```

An entry from a loader without a file is named by its collection and slug instead: `collections.get("pages").get("about"): message`.

- `vite build` fails, listing every broken file.
- The dev server logs the errors, shows them in the error overlay at the first one's location, and keeps serving everything else. Broken documents are left out until you fix them.

Content errors come from:

- the frontmatter, eg YAML that doesn't parse, or a `slug` that isn't a non-empty string
- the schema
- two documents with the same slug
- `transform`, eg a function in what it returns
- a loader that throws, or reports `issues`, eg a `directory()` folder that doesn't exist
- a [reference](/collections#references) to a slug that no document has

## Warnings

Warnings don't stop anything. Each one says what happens because of it:

```
posts: directory "content/posts" has no files, so collections.get("posts") is empty
posts: no files in "content/posts" match "**/*.md", but it has 12 other files, so collections.get("posts") is empty
```

## Config errors

A config that can't be used fails `vite build`. The dev server logs it and keeps running, but `tomekit/content` fails to load until you fix the config:

- `ConfigLoadError`: importing `tomekit.config.ts` threw, eg on a syntax error
- `MissingDefaultExportError`: the file doesn't `export default defineConfig(...)`
- `InvalidConfigError`: the config breaks a rule, eg a collection name that isn't a valid identifier, or a collection without a `loader`

## Catching errors

Every error is a class exported from `tomekit`, so check it with `instanceof`:

| Class | Extends | Thrown when |
| --- | --- | --- |
| `TomekitError` | `Error` | The base of every error |
| `BrokenContentError` | `TomekitError` | A build has content errors. `errors` holds each `ContentError` |
| `ContentError` | `TomekitError` | One problem in a document. It has `file`, `line`, `column`, `collection` and `slug` |
| `ConfigError` | `TomekitError` | The base of config errors |
| `TransformError` | `TomekitError` | The base of errors from `transform`, set as a `ContentError`'s `cause` |
| `PluginError` | `TomekitError` | The base of errors from the Vite plugin |
| `MissingPluginError` | `PluginError` | `tomekit/content` is imported without the `tomekit()` plugin |

Vite wraps errors thrown by plugins and keeps the originals under `errors`:

```ts
import { build } from "vite";
import { BrokenContentError } from "tomekit";

const failure = await build().catch((cause: unknown) => cause);
const errors =
  failure instanceof Error && "errors" in failure ? failure.errors : [];

const broken = Array.isArray(errors)
  ? errors.find((error) => error instanceof BrokenContentError)
  : undefined;

broken?.errors[0]?.file; // "content/posts/hello.md"
```
