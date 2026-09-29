import { MissingPluginError } from "./errors";
import type { Module } from "./module";

function missingPlugin(): never {
  throw new MissingPluginError("tomekit/content-modules");
}

/**
 * Imports a document's module body, eg a compiled MDX file. Only the pages
 * that call it load the module, and each module is imported once. Safe to
 * import in browser code: it holds no documents. Provided by the `tomekit()`
 * Vite plugin, or by `tomekit/register` outside Vite.
 *
 * @example
 * ```tsx
 * import type { MDXModule } from "mdx/types";
 * import { use } from "react";
 * import type { Module } from "tomekit";
 * import { importModule } from "tomekit/content-modules";
 *
 * function Body({ body }: { body: Module<MDXModule> }) {
 *   const { default: Content } = use(importModule(body));
 *   return <Content />;
 * }
 * ```
 */
const importModule: <TExports>(module: Module<TExports>) => Promise<TExports> =
  missingPlugin();

export { importModule };
