import { readFile } from "node:fs/promises";
import path from "node:path";

import { runnerImport } from "vite";

import { cacheKey, codeKey, readCache, writeCache } from "./cache";
import { loadCollection } from "./collection";
import type { CollectionResult, EntryCache, WatchGroup } from "./collection";
import { configIssues } from "./config";
import {
  ConfigLoadError,
  InvalidConfigError,
  MissingDefaultExportError,
} from "./errors";
import type { ContentError } from "./errors";
import {
  contentModule,
  writeModule,
  writeModules,
  writeTypes,
} from "./generate";
import type { Config } from "./index";
import { isProfiling, Profile } from "./profile";
import { checkReferences } from "./reference";
import { isPlainObject } from "./value";

const MODULE_ID = "tomekit/content";

const MODULES_ID = "tomekit/content-modules";

/** The folder, relative to the root, that holds `content.js` and `content.d.ts`. */
const OUTPUT = ".tomekit";

/** The generated module and what happened while building it. */
interface Build {
  /** JavaScript for the `tomekit/content` module. */
  code: string;
  /** Broken files, left out of `code`. */
  errors: ContentError[];
  /** Where this build's time went, when `TOMEKIT_PROFILE` is set. */
  profile: Profile | undefined;
  /** Relative to the root, when this build rewrote them. */
  typesWritten: string | undefined;
  warnings: string[];
}

/** A file, or a folder watched with everything under it. */
interface WatchTarget {
  /** Absolute globs of what no collection watching `path` loads. */
  ignore: readonly string[];
  path: string;
}

interface BuilderOptions {
  /** Absolute path of the config file. */
  configPath: string;
  /** Whether content rebuilds on change for development, in the Vite dev server or `tomekit watch`. Passed to loaders and transforms. */
  dev: boolean;
  /** Whether this builder builds more than once, in dev, `vite build --watch` or `tomekit watch`, so caching entries in memory pays off without a cache on disk. */
  rebuilds: boolean;
  root: string;
}

const GLOB_CHARACTER = /[*?[{]/u;

/** The part of a glob pattern before its first wildcard, eg `content/posts` for `content/posts/**\/*.md`. */
function globBase(pattern: string): string {
  const segments = pattern.split("/");

  const wildcard = segments.findIndex((segment) =>
    GLOB_CHARACTER.test(segment)
  );

  return (wildcard === -1 ? segments : segments.slice(0, wildcard)).join("/");
}

function matches(file: string, { exclude, include }: WatchGroup): boolean {
  return (
    include.some((pattern) => path.matchesGlob(file, pattern)) &&
    !exclude.some((pattern) => path.matchesGlob(file, pattern))
  );
}

function isConfig(value: unknown): value is Config {
  return (
    isPlainObject(value) &&
    "collections" in value &&
    isPlainObject(value.collections)
  );
}

/**
 * Owns everything that outlives one build: the imported config, each
 * collection's last result and entry cache, and the build in progress. Knows
 * nothing about how errors are shown.
 */
class ContentBuilder {
  readonly #options: BuilderOptions;
  #config: Promise<Config> | undefined;
  // Kept after a failed import, so fixing a dependency of the config still reloads.
  #dependencies: string[] = [];
  // Once per builder: a process never reloads an installed package, so the code it runs stays the one this key describes.
  #codeKey: Promise<string | undefined> | undefined;
  /** What cached results depend on besides their entries, from `cacheKey`. Reset with the config. */
  #cacheKey: Promise<string | undefined> | undefined;
  /** Each collection's cache, read from disk once per key. */
  readonly #caches = new Map<string, Promise<EntryCache>>();
  /** Each collection's last result, reused until a file it watches or the config changes. */
  readonly #results = new Map<string, CollectionResult>();
  /** Each collection's `watch` calls from its last `load`. */
  readonly #watched = new Map<string, readonly WatchGroup[]>();
  /** `watch` calls from loads still running, so a change during a slow `load` still reruns it. */
  readonly #pending = new Map<string, WatchGroup[]>();
  /** Bumped on every change, so a build that started before it doesn't keep stale results. */
  #version = 0;
  #build: Promise<Build> | undefined;
  #checkedTsconfig = false;
  // Read once, so every adapter gets the same answer from the same variable.
  readonly #profiling = isProfiling();

  constructor(options: BuilderOptions) {
    this.#options = options;
  }

  /** Files and folders whose changes `changed` looks for, for `vite build --watch`. */
  get watchFiles(): string[] {
    return this.watchTargets.map((target) => target.path);
  }

  /** `watchFiles`, each with the `!` patterns every collection watching it shares, so a watcher can skip what none of them loads. */
  get watchTargets(): WatchTarget[] {
    const { configPath } = this.#options;
    const targets = new Map<string, readonly string[]>();

    function add(target: string, ignore: readonly string[]) {
      const shared = targets.get(target);

      // A path is skipped only when every collection watching the folder leaves it out.
      targets.set(
        target,
        shared === undefined
          ? ignore
          : shared.filter((pattern) => ignore.includes(pattern))
      );
    }

    for (const file of [configPath, ...this.#dependencies]) {
      add(file, []);
    }

    for (const { exclude, include } of [
      ...this.#watched.values(),
      ...this.#pending.values(),
    ].flat()) {
      for (const pattern of include) {
        add(globBase(pattern), exclude);
      }
    }

    return [...targets].map(([target, ignore]) => ({ ignore, path: target }));
  }

  /**
   * The current build, shared by every caller until a change. A build that
   * rejects, eg on a broken config, is retried by the next call.
   */
  async load(): Promise<Build> {
    this.#build ??= this.#run();
    const build = this.#build;

    try {
      return await build;
    } catch (error) {
      if (this.#build === build) {
        this.#build = undefined;
      }

      throw error;
    }
  }

  /**
   * Drops what a changed file invalidates: everything for the config or its
   * dependencies, otherwise the collections that watch it. Returns whether
   * anything was dropped.
   */
  changed(file: string): boolean {
    const { configPath } = this.#options;

    if (file === configPath || this.#dependencies.includes(file)) {
      this.#config = undefined;
      this.#cacheKey = undefined;
      this.#caches.clear();
      this.#results.clear();
    } else {
      const names = [...this.#watched, ...this.#pending].flatMap(
        ([name, groups]) =>
          groups.some((group) => matches(file, group)) ? [name] : []
      );

      if (names.length === 0) {
        return false;
      }

      for (const name of names) {
        this.#results.delete(name);
      }
    }

    this.#version += 1;
    this.#build = undefined;

    return true;
  }

  async #importConfig(): Promise<Config> {
    const { configPath, root } = this.#options;
    // Needs no config, so it runs while the config imports.
    this.#codeKey ??= codeKey(root);
    const name = path.relative(root, configPath);
    let result: Awaited<ReturnType<typeof runnerImport<{ default?: unknown }>>>;

    try {
      result = await runnerImport<{ default?: unknown }>(configPath, {
        configFile: false,
        logLevel: "error",
        root,
      });
    } catch (error) {
      throw new ConfigLoadError(name, error);
    }

    this.#dependencies = result.dependencies.map((file) =>
      path.resolve(root, file)
    );
    const config = result.module.default;

    if (!isConfig(config)) {
      throw new MissingDefaultExportError(name);
    }

    return config;
  }

  async #run(): Promise<Build> {
    const { configPath, dev, root } = this.#options;
    const profile = this.#profiling ? new Profile() : undefined;
    this.#config ??= this.#importConfig();
    const imported = this.#config;
    let config: Config;

    try {
      config = await imported;
    } catch (error) {
      if (this.#config === imported) {
        this.#config = undefined;
      }

      throw error;
    }

    const issues = configIssues(config);

    if (issues.length > 0) {
      throw new InvalidConfigError(path.relative(root, configPath), issues);
    }

    const key = await this.#currentKey();
    profile?.lap("config");
    const version = this.#version;

    const loaded = await Promise.all(
      Object.entries(config.collections).map(async ([name, collection]) => {
        // Without a transform, the cache would only skip validating and serializing, which cost less than reading and writing it.
        const saved = collection.transform === undefined ? undefined : key;
        const cache = await this.#cacheOf(name, saved);
        const reused = this.#results.get(name);
        const watched: WatchGroup[] = [];

        if (reused === undefined) {
          this.#pending.set(name, watched);
        }

        const result =
          reused ??
          (await loadCollection(name, collection, root, {
            cache,
            dev,
            profile,
            watched,
          }));

        if (this.#pending.get(name) === watched) {
          this.#pending.delete(name);
        }

        if (this.#version === version) {
          this.#results.set(name, result);
          const previous = this.#watched.get(name);

          // Kept after a failed load, so fixing what broke it still reruns `load`.
          if (reused === undefined) {
            this.#watched.set(
              name,
              result.failed && previous !== undefined
                ? previous
                : result.watched
            );
          }
        }

        return {
          name,
          ...result,
          cache,
          // A reused result was saved by the build that made it.
          cacheChanged: reused === undefined && result.cacheChanged,
          saved,
        };
      })
    );

    profile?.lap("collections");

    for (const name of this.#watched.keys()) {
      if (!Object.hasOwn(config.collections, name)) {
        this.#watched.delete(name);
      }
    }

    // Every build, not cached: a change in one collection can break or fix references in another.
    const references = checkReferences(loaded, config.references ?? {});

    const collections = loaded.map((collection) => ({
      ...collection,
      documents: collection.documents.filter(
        (document) =>
          references.leftOut.get(collection.name)?.has(document.slug) !== true
      ),
    }));

    profile?.lap("references");
    const warnings = loaded.flatMap((collection) => collection.warnings);

    const code = contentModule(
      collections.map(({ documents, name }) => ({
        name,
        serialized: documents.map(({ serialized }) => serialized),
      }))
    );

    profile?.lap("generate");
    let typesWritten: string | undefined;

    // A build a change made stale leaves the files to the build after it.
    if (this.#version === version) {
      const directory = path.join(root, OUTPUT);

      const generated = collections.map(({ documents, name }) => ({
        name,
        slugs: documents.map((document) => document.slug),
      }));

      const modules = collections.flatMap(({ documents }) =>
        documents.flatMap(({ module }) =>
          module === undefined ? [] : [module]
        )
      );

      const [types] = await Promise.all([
        writeTypes(directory, configPath, generated),
        writeModule(directory, code),
        writeModules(directory, modules),
        ...loaded.map(async (collection) => {
          await this.#saveCache(collection);
        }),
      ]);

      if (types) {
        typesWritten = OUTPUT;
      }
    }

    profile?.lap("write");

    if (!this.#checkedTsconfig) {
      this.#checkedTsconfig = true;
      const warning = await this.#checkTsconfig();

      if (warning !== undefined) {
        warnings.push(warning);
      }
    }

    profile?.end(
      collections.reduce((sum, { documents }) => sum + documents.length, 0)
    );

    return {
      code,
      errors: [
        ...loaded.flatMap((collection) => collection.errors),
        ...references.errors,
      ],
      profile,
      typesWritten,
      warnings,
    };
  }

  /** `cacheKey` for the imported config, computed once per config. */
  async #currentKey(): Promise<string | undefined> {
    const { configPath, root } = this.#options;

    this.#cacheKey ??= (async () => {
      const code = await this.#codeKey;

      return code === undefined
        ? undefined
        : await cacheKey(code, root, [configPath, ...this.#dependencies]);
    })();

    return await this.#cacheKey;
  }

  /** Dev and builds keep separate files, since `dev` can change what a transform returns. */
  #cacheFile(name: string): string {
    const { dev, root } = this.#options;

    return path.join(
      root,
      OUTPUT,
      "cache",
      dev ? "dev" : "build",
      `${name}.json`
    );
  }

  /** The collection's cache: read from disk under `key`, in memory only without one, or none when it would never be reused. */
  async #cacheOf(
    name: string,
    key: string | undefined
  ): Promise<EntryCache | undefined> {
    const { rebuilds, root } = this.#options;

    if (!rebuilds && key === undefined) {
      return undefined;
    }

    let cache = this.#caches.get(name);

    if (cache === undefined) {
      cache =
        key === undefined
          ? Promise.resolve(new Map())
          : readCache(this.#cacheFile(name), { collection: name, key, root });

      this.#caches.set(name, cache);
    }

    return await cache;
  }

  async #saveCache({
    cache,
    cacheChanged,
    name,
    saved,
  }: {
    cache: EntryCache | undefined;
    cacheChanged: boolean;
    name: string;
    saved: string | undefined;
  }): Promise<void> {
    if (saved !== undefined && cache !== undefined && cacheChanged) {
      await writeCache(this.#cacheFile(name), {
        cache,
        collection: name,
        key: saved,
      });
    }
  }

  /** A warning when the root tsconfig does not map `tomekit/content` to the generated types. */
  async #checkTsconfig(): Promise<string | undefined> {
    const { root } = this.#options;
    let source: string;

    try {
      source = await readFile(path.join(root, "tsconfig.json"), "utf-8");
    } catch {
      return undefined;
    }

    // Paths can live in an extended or referenced tsconfig, which this does not follow.
    if (
      source.includes(`"${MODULE_ID}`) ||
      source.includes('"extends"') ||
      source.includes('"references"')
    ) {
      return undefined;
    }

    return `tsconfig.json does not map "${MODULE_ID}", so its imports have no collection types. Add "paths": { "${MODULE_ID}*": ["./${OUTPUT}/content*"] } to compilerOptions.`;
  }
}

export {
  type Build,
  ContentBuilder,
  MODULE_ID,
  MODULES_ID,
  OUTPUT,
  type WatchTarget,
};
