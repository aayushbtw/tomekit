import { readFile } from "node:fs/promises";
import path from "node:path";

import { runnerImport } from "vite";

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

interface BuilderOptions {
  /** Absolute path of the config file. */
  configPath: string;
  /** Whether content rebuilds on change for development, in the Vite dev server or `tomekit watch`. Passed to loaders and transforms. */
  dev: boolean;
  /** Whether this builder builds more than once, in dev, `vite build --watch` or `tomekit watch`, so caching entries pays off. */
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
  readonly #caches = new Map<string, EntryCache>();
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

  /** Files and folders whose changes `changed` looks for, for the dev watcher and `vite build --watch`. */
  get watchFiles(): string[] {
    const { configPath } = this.#options;

    const bases = [...this.#watched.values(), ...this.#pending.values()]
      .flat()
      .flatMap(({ include }) => include.map(globBase));

    return [...new Set([configPath, ...this.#dependencies, ...bases])];
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
    const { configPath, dev, rebuilds, root } = this.#options;
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

    profile?.lap("config");
    const version = this.#version;

    const loaded = await Promise.all(
      Object.entries(config.collections).map(async ([name, collection]) => {
        const cache = rebuilds
          ? (this.#caches.get(name) ?? new Map())
          : undefined;

        if (cache !== undefined) {
          this.#caches.set(name, cache);
        }

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

        return { name, ...result };
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

export { type Build, ContentBuilder, MODULE_ID, MODULES_ID, OUTPUT };
