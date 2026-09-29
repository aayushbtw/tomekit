# TSDoc

Everything users import from `tomekit`, `tomekit/content`, `tomekit/content-modules` and `tomekit/vite`, plus each option field, gets a one-sentence summary, then an `@example` that runs as written, with results in trailing comments.

````ts
/**
 * The document with this slug.
 *
 * @example
 * ```ts
 * posts.get("hello-world").metadata.title // "Hello world"
 * ```
 */
````

- `@param` / `@returns` only when they say something the name and type don't.
- Internal functions get no TSDoc unless they have a contract the types can't express.

