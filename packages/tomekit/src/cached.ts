import path from "node:path";

import type {
  Environment,
  InlineConfig,
  Logger,
  Plugin,
  ResolvedConfig,
} from "vite";

import { codeKey } from "./cache";
import { DuplicateCachedPluginError, UncacheablePluginError } from "./errors";
import { isFunction, isObject, isString } from "./kind";
import { PluginCache } from "./plugin-cache";
import type { KeyParts, TransformOutput, Unstorable } from "./plugin-cache";

/** Enumerable, so a spread copy of a cached plugin keeps it. */
const CACHED: unique symbol = Symbol.for("tomekit.cached");

/** Context members a stored result needs nothing from. */
const SAFE_MEMBERS = new Set([
  "debug",
  "environment",
  "error",
  "info",
  "meta",
  "parse",
]);

type CacheOffReason =
  | "native-config-loader"
  | "no-config-file"
  | "no-lockfile"
  | "unreadable-inline-config";

const CACHE_OFF_REASONS: Record<CacheOffReason, string> = {
  "native-config-loader":
    "Vite's native config loader doesn't report every file the config imports",
  "no-config-file":
    "Vite runs without a config file to stand in for the plugin's options",
  "no-lockfile":
    "there is no lockfile from the root up to show a package upgrade",
  "unreadable-inline-config":
    "the options passed to Vite can't be written as JSON to compare between runs",
};

function isMember<TContext extends object>(
  context: TContext,
  property: PropertyKey
): property is keyof TContext {
  return property in context;
}

/** Methods are bound to `context`, so its private fields keep working. */
function guarded<TContext extends object>(
  context: TContext,
  reads: string[]
): TContext {
  return new Proxy(context, {
    get(target, property) {
      if (
        reads.length === 0 &&
        isString(property) &&
        !SAFE_MEMBERS.has(property)
      ) {
        reads.push(property);
      }

      if (!isMember(target, property)) {
        return undefined;
      }

      const value = target[property];

      return isFunction(value) ? value.bind(target) : value;
    },
  });
}

/** JSON leaves out functions; plugins and the logger can't be compared either. */
function inlineTextOf(inline: InlineConfig): string | undefined {
  try {
    return JSON.stringify({
      ...inline,
      customLogger: undefined,
      plugins: undefined,
    });
  } catch {
    return undefined;
  }
}

function unstorableMessage(file: string, reason: Unstorable): string {
  return "member" in reason
    ? `the transform of ${file} used this.${reason.member}, which a stored result can't repeat, so files whose transform uses it compile every time`
    : `the transform of ${file} returned "${reason.field}", which a stored result can't carry, so files whose transform returns it compile every time`;
}

/**
 * The plugin, with its `transform` results kept in `.tomekit/cache/plugins`,
 * so the next build or dev server reuses each file's result instead of
 * compiling it again.
 *
 * @remarks
 * A result is reused while the file's text and path, the Vite config and the
 * local files it imports, the options passed to Vite, the lockfile and
 * tomekit's version stay the same. Builds and dev, each mode and each Vite
 * environment keep their own results. Every other hook of the plugin runs as
 * before.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import mdx from "@mdx-js/rollup";
 * import { cached, tomekit } from "tomekit/vite";
 * import { defineConfig } from "vite";
 *
 * export default defineConfig({
 *   plugins: [cached({ enforce: "pre", ...mdx() }), tomekit()],
 * });
 * ```
 */
function cached(input: Plugin | { name: string }): Plugin {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: Vite's `plugins` runs any object with a name as a `Plugin`, so one typed for Rollup fits there, and here, without matching Vite's hook types.
  const plugin = input as Plugin;

  if (
    !isObject(plugin) ||
    Array.isArray(plugin) ||
    plugin.transform === undefined
  ) {
    throw new UncacheablePluginError(
      isObject(plugin) && !Array.isArray(plugin) ? plugin.name : undefined
    );
  }

  if (Object.hasOwn(plugin, CACHED)) {
    return plugin;
  }

  const { name } = plugin;
  const buildEnd = isFunction(plugin.buildEnd)
    ? { handler: plugin.buildEnd }
    : plugin.buildEnd;
  const configResolved = isFunction(plugin.configResolved)
    ? { handler: plugin.configResolved }
    : plugin.configResolved;
  const transform = isFunction(plugin.transform)
    ? { handler: plugin.transform }
    : plugin.transform;
  // Keyed by the environment object, not its name: one plugin object can serve several builds.
  const caches = new Map<Environment, Promise<PluginCache | undefined>>();
  const codeKeys = new Map<string, Promise<string | undefined>>();
  const warned = new Set<string>();

  function warn(logger: Logger, reason: string, message: string) {
    if (!warned.has(reason)) {
      warned.add(reason);
      logger.warn(`[tomekit] cached(${name}): ${message}`);
    }
  }

  async function codeOf(root: string): Promise<string | undefined> {
    const code = codeKeys.get(root) ?? codeKey(root);
    codeKeys.set(root, code);

    return await code;
  }

  async function partsOf(
    config: ResolvedConfig
  ): Promise<KeyParts | CacheOffReason> {
    const { configFile, configFileDependencies, inlineConfig } = config;

    if (configFile === undefined) {
      return "no-config-file";
    }

    if (inlineConfig.configLoader === "native") {
      return "native-config-loader";
    }

    const inline = inlineTextOf(inlineConfig);

    if (inline === undefined) {
      return "unreadable-inline-config";
    }

    const code = await codeOf(config.root);

    if (code === undefined) {
      return "no-lockfile";
    }

    return {
      code,
      configFiles: [...new Set([configFile, ...configFileDependencies])],
      inline,
      production: config.isProduction,
    };
  }

  async function open(
    environment: Environment
  ): Promise<PluginCache | undefined> {
    const { config, logger } = environment;
    const parts = await partsOf(config);

    if (isString(parts)) {
      warn(logger, parts, `${CACHE_OFF_REASONS[parts]}, so nothing is cached`);

      return undefined;
    }

    return await PluginCache.open(
      {
        dev: config.command === "serve",
        environment: environment.name,
        mode: config.mode,
        plugin: name,
        root: config.root,
      },
      parts
    );
  }

  async function cacheOf(
    environment: Environment
  ): Promise<PluginCache | undefined> {
    const cache = caches.get(environment) ?? open(environment);
    caches.set(environment, cache);

    return await cache;
  }

  async function close(environment: Environment): Promise<void> {
    // Dev runs `buildEnd` for the client only, when the server closes.
    const closing =
      environment.config.command === "serve"
        ? [...caches.keys()]
        : [environment];

    await Promise.all(
      closing.map(async (closed) => {
        const cache = await caches.get(closed);
        caches.delete(closed);
        await cache?.save();
      })
    );
  }

  const wrapped: Plugin & { readonly [CACHED]: true } = {
    ...plugin,
    [CACHED]: true,
    buildEnd: {
      ...buildEnd,
      async handler(error) {
        await close(this.environment);
        await buildEnd?.handler.call(this, error);
      },
    },
    configResolved: {
      ...configResolved,
      async handler(config) {
        const twins = config.plugins.filter(
          (other) => Object.hasOwn(other, CACHED) && other.name === name
        );

        if (twins.length > 1) {
          throw new DuplicateCachedPluginError(name);
        }

        void codeOf(config.root);
        await configResolved?.handler.call(this, config);
      },
    },
    transform: {
      ...transform,
      async handler(code, id, options): Promise<TransformOutput> {
        const cache = await cacheOf(this.environment);

        if (cache === undefined) {
          return await transform.handler.call(this, code, id, options);
        }

        const hit = cache.get(id, code);

        if (hit !== undefined) {
          return hit;
        }

        const reads: string[] = [];
        const result = await transform.handler.call(
          guarded(this, reads),
          code,
          id,
          options
        );
        const [member] = reads;
        const reason =
          member === undefined ? cache.set(id, code, result) : { member };

        if (reason !== undefined) {
          cache.delete(id);
          const { config, logger } = this.environment;
          warn(
            logger,
            "member" in reason
              ? `member:${reason.member}`
              : `field:${reason.field}`,
            unstorableMessage(path.relative(config.root, id), reason)
          );
        } else if (this.environment.config.command === "serve") {
          cache.saveLater();
        }

        return result;
      },
    },
  };

  return wrapped;
}

export { cached };
