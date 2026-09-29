import type { RegisterHooksOptions } from "node:module";

/**
 * Node module hooks that send every import of a stub, eg `tomekit/content`,
 * to its generated module. They match the resolved URL, not the specifier,
 * since a bundled `vite.config.ts` imports the stub by its file URL.
 *
 * @param generated The generated module's URL, keyed by its stub's URL.
 */
function contentHooks(
  generated: ReadonlyMap<string, string>
): RegisterHooksOptions {
  return {
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      const url = generated.get(resolved.url);

      return url === undefined
        ? resolved
        : { format: "module", shortCircuit: true, url };
    },
  };
}

export { contentHooks };
