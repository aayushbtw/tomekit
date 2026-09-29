// From the registry, because the config imports `fileModule()` through Vite's module runner, a different copy of this module.
const MODULE_PATH = Symbol.for("tomekit.modulePath");

declare const EXPORTS: unique symbol;

/**
 * A document's body when it is a module: the module's file, relative to the
 * project root. Pass it to `importModule` from `tomekit/content-modules` to
 * get the module's exports.
 *
 * @example
 * ```ts
 * import { posts } from "tomekit/content";
 * import { importModule } from "tomekit/content-modules";
 *
 * const { default: Content } = await importModule(posts.get("hello-world").body);
 * ```
 */
// A string at runtime, so a document stays plain data that crosses a server function or loader.
type Module<TExports = unknown> = string & { readonly [EXPORTS]: TExports };

/**
 * A file, returned from `transform` as the body, that pages import on demand
 * through `importModule`. Create one with {@link fileModule}.
 */
// Only a symbol key, like `Skipped`, so no plain object matches it by shape.
interface FileModule<TExports = unknown> {
  readonly [EXPORTS]?: TExports;
  /** Relative to the project root. */
  readonly [MODULE_PATH]: string;
}

/**
 * Makes a file the document's body, compiled by your bundler and imported
 * only by the pages that render it, eg an MDX file with `@mdx-js/rollup`.
 * The type parameter is what the file exports.
 *
 * @param path Relative to the project root, eg `file.path`.
 *
 * @example
 * ```ts
 * import type { MDXModule } from "mdx/types";
 *
 * transform: ({ file }) => ({ body: fileModule<MDXModule>(file.path) })
 * ```
 */
function fileModule<TExports>(path: string): FileModule<TExports> {
  return { [MODULE_PATH]: path };
}

function isFileModule(value: unknown): value is FileModule {
  return (
    value !== null &&
    value !== undefined &&
    new Object(value) === value &&
    MODULE_PATH in value
  );
}

/** The file a module points at, relative to the project root. */
function modulePathOf(module: FileModule): string {
  return module[MODULE_PATH];
}

export { type FileModule, fileModule, isFileModule, type Module, modulePathOf };
