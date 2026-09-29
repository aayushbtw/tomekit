import type { RegisterHooksOptions } from "node:module";

/**
 * Node module hooks that send every import of the `tomekit/content` stub to
 * the generated module. They match the resolved URL, not the specifier, since
 * a bundled `vite.config.ts` imports the stub by its file URL.
 */
function contentHooks(stub: string, generated: string): RegisterHooksOptions {
  return {
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);

      return resolved.url === stub
        ? { format: "module", shortCircuit: true, url: generated }
        : resolved;
    },
  };
}

export { contentHooks };
