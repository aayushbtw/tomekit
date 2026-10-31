import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Plugin } from "vite";

import { cacheKey, hashOf } from "./cache";
import { isFile } from "./collection";
import { replaceFile } from "./generate";
import { isBoolean, isString } from "./kind";
import { isPlainObject } from "./value";

/** Without a miss for this long, dev saves anyway: a dev server stopped with Ctrl+C never runs `buildEnd`. */
const DEV_SAVE_DELAY = 1000;

/** The result fields a stored copy can hand back unchanged. */
const STORED_FIELDS = new Set([
  "code",
  "map",
  "moduleSideEffects",
  "moduleType",
]);

type TransformHook = NonNullable<Plugin["transform"]>;

type TransformHandler = Extract<TransformHook, { handler: unknown }>["handler"];

type TransformOutput = Awaited<ReturnType<TransformHandler>>;

/**
 * Which file a plugin's results go to. Each one is a writer that can run at
 * the same time as another, eg a dev server next to a build, or client next
 * to ssr, so none of them shares a file.
 */
interface CacheScope {
  readonly dev: boolean;
  /** The Vite environment, eg `client` or `ssr`. */
  readonly environment: string;
  readonly mode: string;
  readonly plugin: string;
  readonly root: string;
}

/** What makes every result in a scope's file stale at once. */
interface KeyParts {
  /** `codeKey(root)`. */
  readonly code: string;
  /** The Vite config and the files it imports, read by content: they stand in for the plugin's options, which can hold functions. */
  readonly configFiles: readonly string[];
  /** The options passed to Vite itself, eg `--base`, as text. */
  readonly inline: string;
  readonly production: boolean;
}

/** One transform result as stored. `map` is JSON text, so Vite never mutates a stored map. */
interface StoredResult {
  /** `hashOf` the code the transform received. */
  readonly hash: string;
  readonly code: string;
  readonly map?: string | null;
  readonly moduleSideEffects?: boolean | "no-treeshake";
  readonly moduleType?: string;
}

/** The file on disk. `results` is keyed by id relative to the root, query included. */
interface CacheFile {
  readonly key: string;
  readonly results: Readonly<Record<string, StoredResult>>;
}

/** Why one result wasn't stored. */
type Unstorable =
  /** The result had a field a stored copy can't carry, eg `meta`. */
  | { readonly field: string }
  /** The transform read a context member whose effect a stored copy can't repeat, eg `emitFile`. */
  | { readonly member: string };

/** `.tomekit/cache/plugins/<plugin>/<build|dev>+<mode>+<environment>.json`. `encodeURIComponent` encodes `+` and `/`, so no two scopes share a path. */
function cacheFileOf(scope: CacheScope): string {
  const name = [scope.dev ? "dev" : "build", scope.mode, scope.environment]
    .map((part) => encodeURIComponent(part))
    .join("+");

  return path.join(
    scope.root,
    ".tomekit",
    "cache",
    "plugins",
    encodeURIComponent(scope.plugin),
    `${name}.json`
  );
}

async function keyOf(scope: CacheScope, parts: KeyParts): Promise<string> {
  return hashOf([
    await cacheKey(parts.code, scope.root, parts.configFiles),
    scope.plugin,
    scope.root,
    String(parts.production),
    parts.inline,
  ]);
}

function isStoredResult(value: unknown): value is StoredResult {
  return (
    isPlainObject(value) &&
    "hash" in value &&
    isString(value.hash) &&
    "code" in value &&
    isString(value.code) &&
    (!("map" in value) || value.map === null || isString(value.map)) &&
    (!("moduleType" in value) || isString(value.moduleType)) &&
    (!("moduleSideEffects" in value) ||
      isBoolean(value.moduleSideEffects) ||
      value.moduleSideEffects === "no-treeshake")
  );
}

function isCacheFile(value: unknown): value is CacheFile {
  return (
    isPlainObject(value) &&
    "key" in value &&
    isString(value.key) &&
    "results" in value &&
    isPlainObject(value.results) &&
    Object.values(value.results).every(isStoredResult)
  );
}

/** `id` relative to `root`, query kept, or `undefined` for an id that isn't a file, eg a `\0` virtual module. */
function relativeId(root: string, id: string): string | undefined {
  return path.isAbsolute(id) ? path.relative(root, id) : undefined;
}

function withoutQuery(id: string): string {
  const query = id.indexOf("?");

  return query === -1 ? id : id.slice(0, query);
}

function storedOf(
  hash: string,
  input: string,
  result: Extract<TransformOutput, object>
): StoredResult | Unstorable {
  const extra = Object.entries(result).find(
    ([field, value]) =>
      value !== undefined && value !== null && !STORED_FIELDS.has(field)
  );

  if (extra !== undefined) {
    return { field: extra[0] };
  }

  const { code = input, map, moduleSideEffects, moduleType } = result;

  if (!isString(code)) {
    return { field: "code" };
  }

  return {
    code,
    hash,
    map:
      map === undefined || map === null || isString(map)
        ? map
        : JSON.stringify(map),
    // JSON leaves out an `undefined` field.
    moduleSideEffects: moduleSideEffects ?? undefined,
    moduleType,
  };
}

/**
 * One plugin's results for one scope, read once per process and saved when
 * they changed.
 */
class PluginCache {
  readonly #file: string;
  readonly #key: string;
  readonly #root: string;
  readonly #results: Map<string, StoredResult>;
  /** Ids this process reused or stored. Saving keeps these without a stat. */
  readonly #touched = new Set<string>();
  #dirty = false;
  /** A deleted file stays deleted, so only the first save stats untouched results. */
  #pruned = false;
  /** The save in flight, so a dev timer and `buildEnd` never write at once. */
  #saving: Promise<void> = Promise.resolve();
  #timer: NodeJS.Timeout | undefined;

  private constructor(
    file: string,
    key: string,
    root: string,
    results: Map<string, StoredResult>
  ) {
    this.#file = file;
    this.#key = key;
    this.#root = root;
    this.#results = results;
  }

  /** The scope's cache, starting from its file when the key matches. Never rejects: a missing, unreadable, stale or badly shaped file reads as empty. */
  static async open(scope: CacheScope, parts: KeyParts): Promise<PluginCache> {
    const file = cacheFileOf(scope);
    const [key, text] = await Promise.all([
      keyOf(scope, parts),
      readFile(file, "utf-8").catch(() => undefined),
    ]);

    try {
      const parsed: unknown = text === undefined ? undefined : JSON.parse(text);

      if (isCacheFile(parsed) && parsed.key === key) {
        return new PluginCache(
          file,
          key,
          scope.root,
          new Map(Object.entries(parsed.results))
        );
      }
    } catch {
      // Only a cache: anything wrong with it means compiling again.
    }

    return new PluginCache(file, key, scope.root, new Map());
  }

  /** The stored result for this module, if the transform last received exactly this code. */
  get(id: string, code: string): TransformOutput {
    const relative = relativeId(this.#root, id);
    const stored =
      relative === undefined ? undefined : this.#results.get(relative);

    if (
      relative === undefined ||
      stored === undefined ||
      stored.hash !== hashOf([code])
    ) {
      return undefined;
    }

    this.#touched.add(relative);
    const { map, moduleSideEffects, moduleType } = stored;

    return { code: stored.code, map, moduleSideEffects, moduleType };
  }

  /** Keeps what the transform returned for this code, or drops the old result when it returned nothing. Returns why it couldn't keep it. */
  set(
    id: string,
    code: string,
    result: TransformOutput
  ): Unstorable | undefined {
    const relative = relativeId(this.#root, id);

    if (relative === undefined) {
      return undefined;
    }

    if (result === undefined || result === null) {
      this.delete(id);

      return undefined;
    }

    const hash = hashOf([code]);
    const stored = isString(result)
      ? { code: result, hash }
      : storedOf(hash, code, result);

    if (!("hash" in stored)) {
      this.delete(id);

      return stored;
    }

    this.#results.set(relative, stored);
    this.#touched.add(relative);
    this.#dirty = true;

    return undefined;
  }

  delete(id: string): void {
    const relative = relativeId(this.#root, id);

    if (relative !== undefined && this.#results.delete(relative)) {
      this.#dirty = true;
    }
  }

  /**
   * On the first save, drops results this process never touched whose file is
   * gone. Then writes the results if they changed, through `replaceFile`, so a
   * crash or another writer leaves either file whole. Never rejects.
   */
  async save(): Promise<void> {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    const previous = this.#saving;
    this.#saving = this.#write(previous);
    await this.#saving;
  }

  /** `save` once `DEV_SAVE_DELAY` passes without another call. The timer never keeps a process alive. */
  saveLater(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      void this.save();
    }, DEV_SAVE_DELAY).unref();
  }

  async #write(previous: Promise<void>): Promise<void> {
    await previous;

    if (!this.#pruned) {
      this.#pruned = true;
      const untouched = [...this.#results.keys()].filter(
        (relative) => !this.#touched.has(relative)
      );
      const present = await Promise.all(
        untouched.map(
          async (relative) =>
            await isFile(path.join(this.#root, withoutQuery(relative)))
        )
      );

      for (const [index, relative] of untouched.entries()) {
        if (present[index] === false && this.#results.delete(relative)) {
          this.#dirty = true;
        }
      }
    }

    if (!this.#dirty) {
      return;
    }

    // Cleared before writing, so a miss during the write marks the next save.
    this.#dirty = false;
    const contents: CacheFile = {
      key: this.#key,
      results: Object.fromEntries(this.#results),
    };

    try {
      await replaceFile(this.#file, JSON.stringify(contents));
    } catch {
      this.#dirty = true;
    }
  }
}

export {
  type CacheScope,
  type KeyParts,
  PluginCache,
  type TransformHandler,
  type TransformHook,
  type TransformOutput,
  type Unstorable,
};
