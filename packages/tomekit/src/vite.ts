import path from "node:path";

import type { ErrorPayload, Logger, Plugin, ViteDevServer } from "vite";

import { ContentBuilder, MODULE_ID, MODULES_ID, OUTPUT } from "./builder";
import type { Build } from "./builder";
import { BrokenContentError, PluginNotReadyError } from "./errors";
import type { ContentError } from "./errors";

const RESOLVED_ID = `\0${MODULE_ID}`;

/** Options for the {@link tomekit} Vite plugin. */
interface TomekitOptions {
  /**
   * Path to the config file, relative to the Vite root.
   *
   * @default "tomekit.config.ts"
   */
  config?: "tomekit.config.ts" | (string & Record<never, never>);
}

/**
 * The Vite plugin that loads your collections and serves them as
 * `tomekit/content`.
 *
 * @remarks
 * Content is validated at build time, so a broken file fails `vite build`; in
 * dev it is reported and left out.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { tomekit } from "tomekit/vite";
 *
 * export default defineConfig({ plugins: [tomekit()] });
 * ```
 */
function tomekit({
  config = "tomekit.config.ts",
}: TomekitOptions = {}): Plugin {
  // Hook context lives in closure variables, the usual plugin shape. Content state belongs in ContentBuilder.
  let builder: ContentBuilder | undefined;
  let logger: Logger | undefined;
  let root = process.cwd();
  let server: ViteDevServer | undefined;
  // Each build is reported once, however many modules or environments await it.
  const reported = new WeakSet<Build>();
  // The latest build's, for a browser that connects after it was reported.
  let latestErrors: readonly ContentError[] = [];
  // The latest build's module, so a change that leaves it the same reloads nothing, eg an edit to an MDX body.
  let latestCode: string | undefined;

  function errorPayload(
    errors: readonly ContentError[]
  ): ErrorPayload | undefined {
    const [first] = errors;

    if (first === undefined) {
      return undefined;
    }

    // An entry without a file points at the config, which defines its loader.
    const file = path.resolve(root, first.file ?? config);

    return {
      err: {
        id: file,
        loc: {
          column: first.column ?? 1,
          file,
          line: first.line ?? 1,
        },
        message: new BrokenContentError(errors).message,
        plugin: "tomekit",
        stack: "",
      },
      type: "error",
    };
  }

  function report(build: Build) {
    for (const warning of build.warnings) {
      logger?.warn(`[tomekit] ${warning}`);
    }

    if (build.typesWritten !== undefined) {
      logger?.info(`[tomekit] wrote types to ${build.typesWritten}`);
    }

    if (build.profile !== undefined) {
      logger?.info(`[tomekit] ${build.profile.summary()}`);
    }

    const payload = errorPayload(build.errors);

    if (server === undefined || payload === undefined) {
      return;
    }

    logger?.error(`[tomekit] ${payload.err.message}`);
    server.environments.client.hot.send(payload);
  }

  async function load(): Promise<Build> {
    if (builder === undefined) {
      throw new PluginNotReadyError();
    }

    const build = await builder.load();
    latestErrors = build.errors;
    latestCode = build.code;
    // Watch globs can point outside the root, which the dev watcher does not cover on its own.
    server?.watcher.add(builder.watchFiles);

    if (!reported.has(build)) {
      reported.add(build);
      report(build);
    }

    // A build stops on broken content; dev leaves those files out so the rest keeps working.
    if (server === undefined && build.errors.length > 0) {
      throw new BrokenContentError(build.errors);
    }

    return build;
  }

  /** Builds now in dev, so types and errors don't wait for a page to load. Returns whether the build succeeded. */
  async function rebuild(): Promise<boolean> {
    try {
      await load();

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger?.error(`[tomekit] ${message}`, {
        error: error instanceof Error ? error : undefined,
        timestamp: true,
      });

      return false;
    }
  }

  async function reload(dev: ViteDevServer, file: string) {
    if (builder?.changed(file) !== true) {
      return;
    }

    const previous = latestCode;

    // Invalidated now, so any import from here on waits for the new build.
    const importers = Object.values(dev.environments).filter((environment) => {
      const modules = [...environment.moduleGraph.idToModuleMap].flatMap(
        ([id, module]) => (id.startsWith(RESOLVED_ID) ? [module] : [])
      );

      for (const module of modules) {
        environment.moduleGraph.invalidateModule(module);
      }

      return modules.length > 0;
    });

    // Reloads only once the build is done and only if it changed the module, so an
    // edit to a module body, eg MDX, is left to the bundler's HMR. A failed build
    // still reloads, so the page shows the error.
    if ((await rebuild()) && latestCode === previous) {
      return;
    }

    // The browser too, even when only server code imports the content: the page it shows was rendered from it.
    for (const environment of new Set([
      ...importers,
      dev.environments.client,
    ])) {
      environment.hot.send({ type: "full-reload" });
    }
  }

  return {
    // Loads content up front, so types exist and errors show before anything
    // imports it. A build fails here; dev logs the error and keeps serving.
    async buildStart() {
      await (server === undefined ? load() : rebuild());
    },

    // Pre-bundling would cache tomekit's runtime by version, so a linked or
    // locally built tomekit could keep serving stale code, and the plugin's
    // own module must never be bundled from its stub.
    configEnvironment() {
      return {
        optimizeDeps: { exclude: ["tomekit", MODULE_ID, MODULES_ID] },
      };
    },

    configResolved(resolved) {
      ({ logger, root } = resolved);
      builder = new ContentBuilder({
        configPath: path.resolve(root, config),
        dev: resolved.command === "serve",
        rebuilds: resolved.command === "serve" || resolved.build.watch !== null,
        root,
      });
    },

    configureServer(dev) {
      server = dev;
      dev.watcher.on("all", (_event, file) => {
        void reload(dev, file);
      });
      dev.environments.client.hot.on("vite:client:connect", (_data, client) => {
        const payload = errorPayload(latestErrors);

        if (payload !== undefined) {
          client.send(payload);
        }
      });
    },

    // Ahead of Vite's own resolver, which would otherwise find the stub that
    // `tomekit/content` ships for use without the plugin.
    enforce: "pre",

    async load(id) {
      if (id !== RESOLVED_ID) {
        return null;
      }

      if (this.environment.name === "client") {
        logger?.warn(
          `[tomekit] ${MODULE_ID} was imported in the browser bundle, so its documents ship to the client. Import it from server code only.`
        );
      }

      try {
        const build = await load();

        // No source map: generated data maps to nothing, and Vite would otherwise inline one as big as the module.
        return { code: build.code, map: { mappings: "" } };
      } finally {
        // For `vite build --watch`; the dev server watches through `configureServer`.
        for (const file of builder?.watchFiles ?? []) {
          this.addWatchFile(file);
        }
      }
    },

    name: "tomekit",

    // `tomekit/content-modules` is the generated file itself, so its imports of
    // content files resolve relative to it, and Vite watches it like any file.
    async resolveId(id) {
      if (id === MODULE_ID) {
        return RESOLVED_ID;
      }

      if (id !== MODULES_ID) {
        return undefined;
      }

      await load();

      return path.join(root, OUTPUT, "content-modules.js");
    },
  };
}

export { tomekit, type TomekitOptions };
