# Errors

- **Return problems, don't throw them.** Lower layers return results (`{ document } | { issues }`, `{ entries, errors }`). Only the adapter decides: `vite build` throws, dev logs the errors, shows them in the overlay and serves the files that work.
- **Collect, don't stop.** Report every broken file in one pass.
- **Point at the source.** A content problem is a `ContentError` printed as `file:line:column: message`, with `file` relative to the root. When a key is missing, point at the deepest parent that exists. With no frontmatter at all, leave line and column out.
- **Messages name the fix**: ``transform returned "url", but it can only return `metadata` and `body`. Put derived values inside `metadata` instead``.
- **Warnings state the consequence**: `directory "x" has no files, so the collection is empty`.
- Only the adapter adds the `[tomekit]` prefix and talks to the logger.
- **Every thrown error is a class in `src/errors/`**, one per file, exported from `src/errors/index.ts`. No `throw new Error(...)` in `src/`. Classes extend a category (`ConfigError`, `ContentError`, `TransformError`, `PluginError`), which extends `TomekitError`. Each sets `name` explicitly, and its constructor takes data and builds the message. Add a class per distinct failure, not per call site. Wrapped errors go in `cause`.
