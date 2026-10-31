import { PluginError } from "./plugin-error";

/** Two plugins wrapped in `cached()` share a name, which picks their cache files. */
class DuplicateCachedPluginError extends PluginError {
  override name = "DuplicateCachedPluginError";

  constructor(plugin: string) {
    super(
      `cached() wraps two plugins named "${plugin}", so their caches would overwrite each other. Give one its own name, eg cached({ ...mdx(), name: "mdx-blog" })`
    );
  }
}

export { DuplicateCachedPluginError };
