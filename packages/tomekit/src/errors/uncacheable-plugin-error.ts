import { PluginError } from "./plugin-error";

/** `cached()` was given something without a `transform` hook. */
class UncacheablePluginError extends PluginError {
  override name = "UncacheablePluginError";

  /** `plugin` is the given plugin's name, when it has one. */
  constructor(plugin: string | undefined) {
    super(
      plugin === undefined
        ? "cached() needs one plugin with a transform hook. Wrap the plugin that compiles the files, eg cached(mdx())"
        : `cached() needs a plugin with a transform hook, but "${plugin}" has none, so there is nothing to cache. Wrap the plugin that compiles the files, eg cached(mdx())`
    );
  }
}

export { UncacheablePluginError };
