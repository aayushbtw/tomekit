import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { isFile } from "./collection";
import type { BuiltDocument, EntryCache } from "./collection";
import { replaceFile } from "./generate";
import { serialize } from "./serialize";
import { REASON, Skipped } from "./skipped";
import {
  assertContentValue,
  isFields,
  isList,
  isMap,
  isNumber,
  isPlainObject,
  isSet,
} from "./value";
import type { ContentValue } from "./value";

/** Changed whenever a cache file's shape or meaning changes, so older files are dropped. */
const FORMAT = "1";

/** Checked from the root up. `runnerImport` lists no file under `node_modules`, so a package upgrade shows only here. */
const LOCKFILES = [
  "bun.lock",
  "bun.lockb",
  "npm-shrinkwrap.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
];

/** How `Number` spells the numbers JSON can't hold. */
const SPECIAL_NUMBERS = new Set(["-0", "-Infinity", "Infinity", "NaN"]);

/** A `ContentValue` as JSON. See `encode` for the tagged lists. */
type Encoded = boolean | number | string | null | EncodedFields | EncodedList;

interface EncodedFields {
  readonly [key: string]: Encoded;
}

/** A tag, then the items it needs. */
interface EncodedList extends ReadonlyArray<Encoded> {}

/** One document in a cache file. */
interface CacheRecord {
  file?: string;
  hash: string;
  /** The output as `serialize` wrote it, when it is JSON. */
  json?: string;
  module?: string;
  setsSlug: boolean;
  /** The reason the transform skipped the document, or `null` when it gave none. */
  skip?: string | null;
  slug: string;
  /** The output, when it holds values JSON can't, eg a `Date`. */
  value?: Encoded;
}

interface CacheFile {
  collection: string;
  entries: CacheRecord[];
  key: string;
}

function isString(value: unknown): value is string {
  return new Object(value) instanceof String;
}

function isText(value: Encoded | undefined): value is string {
  return new Object(value) instanceof String;
}

function isTime(value: Encoded | undefined): value is number {
  return new Object(value) instanceof Number && Number.isFinite(value);
}

function isEncodedList(value: Encoded): value is EncodedList {
  return Array.isArray(value);
}

/** Whether a list of checked items has a known tag and the items that tag needs. */
function isTagged(list: EncodedList): boolean {
  const [tag, ...items] = list;
  const [first, second] = items;

  switch (tag) {
    case "a":
    case "s": {
      return true;
    }

    case "d": {
      return items.length === 1 && (first === null || isTime(first));
    }

    case "h":
    case "u": {
      return items.length === 0;
    }

    case "l": {
      return items.length === 1 && isText(first) && URL.canParse(first);
    }

    case "m": {
      return items.length % 2 === 0;
    }

    case "n": {
      return items.length === 1 && isText(first) && SPECIAL_NUMBERS.has(first);
    }

    case "r": {
      return items.length === 2 && isText(first) && isText(second);
    }

    default: {
      return false;
    }
  }
}

function isEncoded(value: unknown): value is Encoded {
  if (value === null) {
    return true;
  }

  const boxed = new Object(value);

  if (boxed !== value) {
    return (
      boxed instanceof Boolean ||
      boxed instanceof Number ||
      boxed instanceof String
    );
  }

  if (Array.isArray(value)) {
    return value.every(isEncoded) && isTagged(value);
  }

  return isPlainObject(value) && Object.values(value).every(isEncoded);
}

function isCacheRecord(value: unknown): value is CacheRecord {
  if (
    !isPlainObject(value) ||
    !("hash" in value && isString(value.hash)) ||
    !("slug" in value && isString(value.slug)) ||
    !("setsSlug" in value && new Object(value.setsSlug) instanceof Boolean) ||
    ("file" in value && !isString(value.file)) ||
    ("module" in value && !isString(value.module))
  ) {
    return false;
  }

  const outputs = [
    "json" in value && isString(value.json),
    "value" in value && isEncoded(value.value),
    "skip" in value && (value.skip === null || isString(value.skip)),
  ];

  return outputs.filter(Boolean).length === 1;
}

function isCacheFile(value: unknown): value is CacheFile {
  return (
    isPlainObject(value) &&
    "collection" in value &&
    isString(value.collection) &&
    "key" in value &&
    isString(value.key) &&
    "entries" in value &&
    Array.isArray(value.entries) &&
    value.entries.every(isCacheRecord)
  );
}

/**
 * A value as JSON, keeping what JSON would drop or change. Arrays and values
 * JSON can't hold become a list that starts with a tag: `a` array (`h` for a
 * hole), `d` Date, `l` URL, `m` Map of `[key, value]` pairs, `n` NaN, ±Infinity
 * or -0, `r` RegExp, `s` Set, `u` undefined.
 */
function encode(value: ContentValue): Encoded {
  if (value === undefined) {
    return ["u"];
  }

  if (value === null) {
    return null;
  }

  if (isNumber(value)) {
    if (Object.is(value, -0)) {
      return ["n", "-0"];
    }

    return Number.isFinite(value) ? value : ["n", String(value)];
  }

  if (isList(value)) {
    return [
      "a",
      ...Array.from({ length: value.length }, (_, index) =>
        index in value ? encode(value[index]) : ["h"]
      ),
    ];
  }

  if (isFields(value)) {
    // `fromEntries` defines each key, so a `__proto__` key stays a key.
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, encode(entry)])
    );
  }

  if (isMap(value)) {
    return [
      "m",
      ...[...value].flatMap(([key, entry]) => [encode(key), encode(entry)]),
    ];
  }

  if (isSet(value)) {
    return ["s", ...[...value].map((entry) => encode(entry))];
  }

  if (value instanceof Date) {
    const time = value.getTime();

    return ["d", Number.isNaN(time) ? null : time];
  }

  if (value instanceof URL) {
    return ["l", value.href];
  }

  if (value instanceof RegExp) {
    return ["r", value.source, value.flags];
  }

  return value;
}

// `isTagged` checked every list, so the fallback is never used.
function textOf(value: Encoded | undefined): string {
  return isText(value) ? value : "";
}

function isHole(value: Encoded): boolean {
  return isEncodedList(value) && value[0] === "h";
}

function decode(value: Encoded): ContentValue {
  if (!isEncodedList(value)) {
    return isFields(value)
      ? Object.fromEntries(
          Object.entries(value).map(([key, entry]) => [key, decode(entry)])
        )
      : value;
  }

  const [tag, ...items] = value;
  const [first = null, second = null] = items;

  switch (tag) {
    case "a": {
      const list: ContentValue[] = [];
      list.length = items.length;

      for (const [index, item] of items.entries()) {
        if (!isHole(item)) {
          list[index] = decode(item);
        }
      }

      return list;
    }

    case "d": {
      return new Date(isTime(first) ? first : Number.NaN);
    }

    case "l": {
      return new URL(textOf(first));
    }

    case "m": {
      const map = new Map<ContentValue, ContentValue>();

      for (let index = 0; index < items.length; index += 2) {
        map.set(decode(items[index] ?? null), decode(items[index + 1] ?? null));
      }

      return map;
    }

    case "n": {
      return Number(textOf(first));
    }

    case "r": {
      return new RegExp(textOf(first), textOf(second));
    }

    case "s": {
      return new Set(items.map((item) => decode(item)));
    }

    default: {
      return undefined;
    }
  }
}

function recordOf(document: BuiltDocument, hash: string): CacheRecord {
  const { file, module, output, serialized, setsSlug, slug } = document;
  const record: CacheRecord = { file, hash, module, setsSlug, slug };

  if (output instanceof Skipped) {
    return { ...record, skip: output[REASON] ?? null };
  }

  return "json" in serialized
    ? { ...record, json: serialized.json }
    : { ...record, value: encode(output) };
}

function documentOf(record: CacheRecord): BuiltDocument {
  const { file, json, module, setsSlug, skip, slug, value } = record;
  const shared = { file, locate: undefined, module, setsSlug, slug };

  if (json !== undefined) {
    const output: unknown = JSON.parse(json);
    assertContentValue(output);

    return { ...shared, output, serialized: { json } };
  }

  if (value !== undefined) {
    const output = decode(value);

    return { ...shared, output, serialized: serialize(output) };
  }

  return {
    ...shared,
    output: new Skipped(skip ?? undefined),
    serialized: { source: "" },
  };
}

async function readIfPresent(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch {
    return undefined;
  }
}

/** The lockfiles in the closest folder that has any, from `root` up. */
async function lockfilesOf(root: string): Promise<Buffer[]> {
  let directory = root;

  while (true) {
    const found = await Promise.all(
      LOCKFILES.map((name) => readIfPresent(path.join(directory, name)))
    );

    const lockfiles = found.filter((text) => text !== undefined);
    const parent = path.dirname(directory);

    if (lockfiles.length > 0 || parent === directory) {
      return lockfiles;
    }

    directory = parent;
  }
}

/** tomekit's own code: every module next to this one, so a new version or a local build clears the cache. */
async function ownCode(): Promise<Buffer[]> {
  const extension = path.extname(import.meta.filename);

  const names = (await readdir(import.meta.dirname))
    .filter((name) => name.endsWith(extension))
    .toSorted();

  return await Promise.all(
    names.map((name) => readFile(path.join(import.meta.dirname, name)))
  );
}

function hashOf(parts: readonly (Buffer | string)[]): string {
  const hash = createHash("sha1");

  for (const part of parts) {
    // Each part's length first, so moving bytes between parts changes the hash.
    hash.update(`\0${part.length}\0`).update(part);
  }

  return hash.digest("base64");
}

/**
 * The code a transform runs besides the config: installed packages and
 * tomekit itself. `undefined` without a lockfile, since a package upgrade
 * could then go unnoticed. Needs no config, so it can run while one imports.
 */
async function codeKey(root: string): Promise<string | undefined> {
  // Never rejects: a build whose config fails to import never awaits it.
  try {
    const [lockfiles, code] = await Promise.all([lockfilesOf(root), ownCode()]);

    return lockfiles.length === 0
      ? undefined
      : hashOf([FORMAT, ...lockfiles, ...code]);
  } catch {
    return undefined;
  }
}

/** What every cached result depends on besides its entry: `codeKey`, plus the config and the files it imports. */
async function cacheKey(
  code: string,
  root: string,
  configFiles: readonly string[]
): Promise<string> {
  const configs = await Promise.all(
    configFiles
      .toSorted()
      .map(async (file) => [
        path.relative(root, file),
        (await readIfPresent(file)) ?? "missing",
      ])
  );

  return hashOf([code, ...configs.flat()]);
}

/**
 * A collection's cached results, or an empty cache when the file is missing,
 * unreadable, or from another key. Drops documents whose module file is gone.
 */
async function readCache(
  file: string,
  { collection, key, root }: { collection: string; key: string; root: string }
): Promise<EntryCache> {
  // Only a cache: anything wrong with it means building without it.
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf-8"));

    if (
      !isCacheFile(parsed) ||
      parsed.key !== key ||
      parsed.collection !== collection
    ) {
      return new Map();
    }

    const present = await Promise.all(
      parsed.entries.map(
        async (record) =>
          record.module === undefined ||
          (await isFile(path.join(root, record.module)))
      )
    );

    return new Map(
      parsed.entries
        .filter((_, index) => present[index] === true)
        .map((record) => [
          record.slug,
          { document: documentOf(record), hash: record.hash },
        ])
    );
  } catch {
    return new Map();
  }
}

async function writeCache(
  file: string,
  {
    cache,
    collection,
    key,
  }: { cache: EntryCache; collection: string; key: string }
): Promise<void> {
  const entries = [...cache.values()].map(({ document, hash }) =>
    recordOf(document, hash)
  );

  const contents: CacheFile = { collection, entries, key };
  await replaceFile(file, JSON.stringify(contents));
}

export { cacheKey, codeKey, readCache, writeCache };
