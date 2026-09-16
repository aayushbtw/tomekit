# tomekit

## 0.7.0

### Minor Changes

- [`fb568af`](https://github.com/aayushbtw/tomekit/commit/fb568af0c061beab8cab63f46d68df2e6169f15b) - **Breaking:** A missing content directory fails the build instead of warning. The error says to create it or fix the path passed to `directory()`.

- [`fb568af`](https://github.com/aayushbtw/tomekit/commit/fb568af0c061beab8cab63f46d68df2e6169f15b) - **Breaking:** `collections.get("…")` and `.get("slug")` reject a literal that isn't a known name or slug, so a typo fails to compile. Strings built at runtime still work.

### Patch Changes

- [`fb568af`](https://github.com/aayushbtw/tomekit/commit/fb568af0c061beab8cab63f46d68df2e6169f15b) - Issues in an empty frontmatter block (`---` then `---`) point at the right line.

- [`fb568af`](https://github.com/aayushbtw/tomekit/commit/fb568af0c061beab8cab63f46d68df2e6169f15b) - A folder that can't be loaded says why: it's a file, not a directory (with the `directory(...)` call to use instead), or it can't be read.

- [`fb568af`](https://github.com/aayushbtw/tomekit/commit/fb568af0c061beab8cab63f46d68df2e6169f15b) - The "no files match" warning says how many other files the folder has. A folder holding only `.gitkeep` counts as empty.

- [`fb568af`](https://github.com/aayushbtw/tomekit/commit/fb568af0c061beab8cab63f46d68df2e6169f15b) - A reference on a collection with no string fields is a type error with a message.

- [`fb568af`](https://github.com/aayushbtw/tomekit/commit/fb568af0c061beab8cab63f46d68df2e6169f15b) - A schema that doesn't produce an object is a type error that says so, eg `z.strictObject({ title: z.string() })`.

- [`fb568af`](https://github.com/aayushbtw/tomekit/commit/fb568af0c061beab8cab63f46d68df2e6169f15b) - A `transform` that returns `metadata` that isn't an object fails the build with `TransformMetadataError`.
