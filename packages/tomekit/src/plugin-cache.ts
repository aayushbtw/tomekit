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

const STORED_FIELDS = new Set([
  "code",
  "map",
  "moduleSideEffects",
  "moduleType",
]);

type TransformHook = NonNullable<Plugin["transform"]>;

type TransformHandler = Extract<TransformHook, { handler: unknown }>["handler"];

type TransformOutput = Awaited<ReturnType<TransformHandler>>;

/** Each scope is a writer that can run next to another, eg a dev server next to a build, or client next to ssr, so none of them shares a file. */
interface CacheScope {
  readonly dev: boolean;
  readonly environment: string;
  readonly mode: string;
  readonly plugin: string;
  readonly root: string;
}

interface KeyParts {
  readonly code: string;
  /** The Vite config and the files it imports, read by content: they stand in for the plugin's options, which can hold functions. */
  readonly configFiles: readonly string[];
  readonly inline: string;
  readonly production: boolean;
}

/** `map` is JSON text, so Vite never mutates a stored map. */
interface StoredResult {
  readonly inputHash: string;
  readonly code: string;
  readonly map?: string | null;
  readonly moduleSideEffects?: boolean | "no-treeshake" | null;
  readonly moduleType?: string;
}

/** `results` is keyed by id relative to the root, query included. */
interface CacheFile {
  readonly key: string;
  readonly results: Readonly<Record<string, StoredResult>>;
}

type Unstorable = { readonly field: string } | { readonly member: string };

/** `encodeURIComponent` encodes `+` and `/`, so no two scopes share a path. */
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
    "inputHash" in value &&
    isString(value.inputHash) &&
    "code" in value &&
    isString(value.code) &&
    (!("map" in value) || value.map === null || isString(value.map)) &&
    (!("moduleType" in value) || isString(value.moduleType)) &&
    (!("moduleSideEffects" in value) ||
      value.moduleSideEffects === null ||
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

function relativeId(root: string, id: string): string | undefined {
  return path.isAbsolute(id) ? path.relative(root, id) : undefined;
}

function withoutQuery(id: string): string {
  const query = id.indexOf("?");

  return query === -1 ? id : id.slice(0, query);
}

function storedOf(
  inputHash: string,
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
    inputHash,
    map:
      map === undefined || map === null || isString(map)
        ? map
        : JSON.stringify(map),
    moduleSideEffects,
    moduleType,
  };
}

class PluginCache {
  readonly #file: string;
  readonly #key: string;
  readonly #root: string;
  readonly #results: Map<string, StoredResult>;
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

  /** Never rejects: a missing, unreadable, stale or badly shaped file reads as empty. */
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

  get(id: string, code: string): TransformOutput {
    const relative = relativeId(this.#root, id);
    const stored =
      relative === undefined ? undefined : this.#results.get(relative);

    if (
      relative === undefined ||
      stored === undefined ||
      stored.inputHash !== hashOf([code])
    ) {
      return undefined;
    }

    this.#touched.add(relative);
    const { map, moduleSideEffects, moduleType } = stored;

    return { code: stored.code, map, moduleSideEffects, moduleType };
  }

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

    const inputHash = hashOf([code]);
    const stored = isString(result)
      ? { code: result, inputHash }
      : storedOf(inputHash, code, result);

    if (!("inputHash" in stored)) {
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

  /** Never rejects. */
  async save(): Promise<void> {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    const previous = this.#saving;
    this.#saving = this.#write(previous);
    await this.#saving;
  }

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
