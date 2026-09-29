import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";

import type { Glob } from "./directory";
import { assertTransformResult, buildDocument } from "./document";
import { ContentError, MissingModuleError } from "./errors";
import type {
  CollectionConfig,
  Entry,
  LoadContext,
  LoadResult,
  Source,
} from "./index";
import { isLocated, LOCATE } from "./parse";
import type { Locate } from "./parse";
import { PROFILE, timed } from "./profile";
import type { Profile } from "./profile";
import { serialize } from "./serialize";
import type { Serialized } from "./serialize";
import { REASON, Skipped } from "./skipped";
import { validate } from "./validate";
import { assertContentValue, isPlainObject } from "./value";
import type { ContentValue } from "./value";

/** A document as the build needs it: its output, serialized for the generated module, and where it came from. */
interface BuiltDocument {
  /** `output`, ready to write into the generated module. Empty for a skipped document. */
  serialized: Serialized;
  /** Relative to the root, or `undefined` when the loader gave no file. */
  file: string | undefined;
  /** Where a metadata key is written, when the loader can tell. */
  locate: Locate | undefined;
  /** The file the body points at, relative to the root, when the body is a module. */
  module: string | undefined;
  output: ContentValue | Skipped;
  /** Computed before the transform, so lookups work whatever it returns. */
  slug: string;
  /** Whether the metadata sets `slug`, rather than the loader choosing it. */
  setsSlug: boolean;
}

/** An entry's last result by slug, reused while the entry and the config are unchanged. */
type EntryCache = Map<string, { document: BuiltDocument; hash: string }>;

/** One `watch` call's globs, as absolute patterns. */
interface WatchGroup {
  /** Only leaves out files matched by `include` from the same call. */
  exclude: string[];
  include: string[];
}

interface CollectionResult {
  /** Slugs of entries with errors, so a reference to one can say why it does not resolve. */
  broken: Set<string>;
  /** Every kept document, in the loader's order. Broken entries are left out. */
  documents: BuiltDocument[];
  errors: ContentError[];
  /** Whether `load` threw or returned no `entries` array. */
  failed: boolean;
  /** Slugs a transform skipped, with the reason it gave. */
  skipped: Map<string, string | undefined>;
  /** Every `watch` call `load` made, including before it threw. */
  watched: WatchGroup[];
  warnings: string[];
}

type EntryResult =
  | { document: BuiltDocument; errors?: undefined }
  | { errors: ContentError[] };

function skip(reason?: string): Skipped {
  return new Skipped(reason);
}

function hash(text: string): string {
  return createHash("sha1").update(text).digest("base64");
}

/** Changes whenever anything the transform or the document could depend on changes. */
function entryHashOf(entry: Entry, metadata: ContentValue): string {
  const text = serialize({
    body: entry.body,
    file: entry.file === undefined ? undefined : { path: entry.file.path },
    metadata,
    slug: entry.slug,
  });

  return hash("json" in text ? text.json : text.source);
}

function metadataOf(entry: Entry): ContentValue {
  const raw: unknown = entry.metadata ?? {};
  assertContentValue(raw);

  return raw;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function isSlug(value: unknown): value is string {
  return new Object(value) instanceof String && value !== "";
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

function isLoadResult(value: unknown): value is LoadResult {
  return (
    isPlainObject(value) && "entries" in value && Array.isArray(value.entries)
  );
}

async function loadCollection(
  name: string,
  collection: CollectionConfig,
  root: string,
  {
    cache,
    dev = false,
    profile,
    watched = [],
  }: {
    cache?: EntryCache;
    dev?: boolean;
    profile?: Profile;
    /** Receives each `watch` call as it happens, so a caller can match changes while `load` runs. */
    watched?: WatchGroup[];
  } = {}
): Promise<CollectionResult> {
  let loaded: unknown;

  function watch(patterns: Glob | readonly Glob[]) {
    const list = [patterns].flat();

    watched.push({
      exclude: list
        .filter((pattern) => pattern.startsWith("!"))
        .map((pattern) => path.resolve(root, pattern.slice(1))),
      include: list
        .filter((pattern) => !pattern.startsWith("!"))
        .map((pattern) => path.resolve(root, pattern)),
    });
  }

  try {
    const context: LoadContext = { collection: name, dev, root, watch };

    // Not in `LoadContext`'s type: only `directory()` reads it.
    if (profile !== undefined) {
      Object.assign(context, { [PROFILE]: profile });
    }

    loaded = await collection.loader.load(context);
  } catch (error) {
    return {
      broken: new Set(),
      documents: [],
      errors: [
        new ContentError(
          { collection: name },
          { message: `the loader failed: ${messageOf(error)}` },
          { cause: error }
        ),
      ],
      failed: true,
      skipped: new Map(),
      warnings: [],
      watched,
    };
  }

  if (!isLoadResult(loaded)) {
    return {
      broken: new Set(),
      documents: [],
      errors: [
        new ContentError(
          { collection: name },
          {
            message:
              "the loader's `load` must return an object with an `entries` array, eg `{ entries: [] }`",
          }
        ),
      ],
      failed: true,
      skipped: new Map(),
      warnings: [],
      watched,
    };
  }

  const errors = (loaded.issues ?? []).map(
    ({ cause, file, slug, ...issue }) =>
      new ContentError({ collection: name, file, slug }, issue, { cause })
  );

  // An entry a loader reported an issue for is still validated, so all of its problems show, but it is left out.
  const reported = new Set(
    (loaded.issues ?? []).map(({ file, slug }) =>
      file === undefined ? `slug:${slug}` : `file:${file}`
    )
  );

  const results = await Promise.all(
    loaded.entries.map(async (entry) => {
      const key =
        entry.file === undefined
          ? `slug:${entry.slug}`
          : `file:${entry.file.path}`;

      return await loadEntry(name, collection, entry, {
        broken: reported.has(key),
        cache,
        dev,
        profile,
        root,
      });
    })
  );

  if (cache !== undefined) {
    const present = new Set(loaded.entries.map((entry) => entry.slug));

    for (const slug of cache.keys()) {
      if (!present.has(slug)) {
        cache.delete(slug);
      }
    }
  }

  const bySlug = new Map<string, BuiltDocument>();
  const documents: BuiltDocument[] = [];
  const broken = new Set<string>();
  const skipped = new Map<string, string | undefined>();

  for (const [index, result] of results.entries()) {
    if (result.errors) {
      errors.push(...result.errors);
      const slug = loaded.entries[index]?.slug;

      if (isSlug(slug)) {
        broken.add(slug);
      }

      continue;
    }

    const { document } = result;

    if (document.output instanceof Skipped) {
      skipped.set(document.slug, document.output[REASON]);
      continue;
    }

    const first = bySlug.get(document.slug);

    if (first !== undefined) {
      errors.push(duplicateSlug(name, document, first));
      continue;
    }

    bySlug.set(document.slug, document);
    documents.push(document);
  }

  return {
    broken,
    documents,
    errors,
    failed: false,
    skipped,
    warnings: [...(loaded.warnings ?? [])],
    watched,
  };
}

function duplicateSlug(
  name: string,
  document: BuiltDocument,
  first: BuiltDocument
): ContentError {
  const used = `slug "${document.slug}" is already used by`;

  if (document.file === undefined) {
    return new ContentError(
      { collection: name, slug: document.slug },
      { message: `${used} another entry. Return a unique slug from the loader` }
    );
  }

  const fix = document.setsSlug
    ? "Change this file's `slug`"
    : "Rename this file, or set a different `slug` in its frontmatter";

  // Located here, only for a duplicate, from the current `locate`: an edit can move the line.
  const position = document.setsSlug ? document.locate?.(["slug"]) : undefined;

  return new ContentError(
    { collection: name, file: document.file },
    {
      ...position,
      message: `${used} ${first.file ?? "another entry"}. ${fix}`,
    }
  );
}

/** What `transform` made of a source, ready for the generated module. */
interface Transformed {
  module: string | undefined;
  output: ContentValue | Skipped;
  serialized: Serialized;
}

/** Runs `transform` on a source and builds its document. Throws what `transform` threw, or why its result can't be used. */
async function transformSource(
  name: string,
  collection: CollectionConfig,
  source: Source<object>,
  { dev, profile, root }: { dev: boolean; profile?: Profile; root: string }
): Promise<Transformed> {
  profile?.run("transform");

  // Awaited apart from the call, so a profile times only the transform's synchronous part, not other entries' work.
  const pending = timed(profile, "transform", () =>
    collection.transform
      ? collection.transform(source, { collection: name, dev, skip })
      : {}
  );

  const result: unknown = await pending;

  if (result instanceof Skipped) {
    return { module: undefined, output: result, serialized: { source: "" } };
  }

  const { document, module } = timed(profile, "serialize", () => {
    assertTransformResult(result);

    return buildDocument(source, result, root);
  });

  if (module !== undefined && !(await isFile(path.join(root, module)))) {
    throw new MissingModuleError(module);
  }

  const serialized = timed(profile, "serialize", () => serialize(document));

  return { module, output: document, serialized };
}

async function loadEntry(
  name: string,
  collection: CollectionConfig,
  entry: Entry,
  {
    broken,
    cache,
    dev,
    profile,
    root,
  }: {
    broken: boolean;
    cache?: EntryCache;
    dev: boolean;
    profile?: Profile;
    root: string;
  }
): Promise<EntryResult> {
  const file = entry.file?.path;
  const subject = { collection: name, file, slug: entry.slug };

  function failure(cause: unknown): EntryResult {
    return {
      errors: [
        new ContentError(subject, { message: messageOf(cause) }, { cause }),
      ],
    };
  }

  if (!isSlug(entry.slug)) {
    return {
      errors: [
        new ContentError(
          { collection: name, file },
          {
            message: `slug must be a non-empty string, got ${JSON.stringify(entry.slug)}`,
          }
        ),
      ],
    };
  }

  let metadata: ContentValue;

  try {
    metadata = timed(profile, "serialize", () => metadataOf(entry));
  } catch (error) {
    return failure(error);
  }

  // Only worth computing when a later build can reuse the result.
  const entryHash =
    cache === undefined
      ? undefined
      : timed(profile, "hash", () => entryHashOf(entry, metadata));

  const locate = isLocated(entry) ? entry[LOCATE] : undefined;
  const cached = broken ? undefined : cache?.get(entry.slug);

  // With the current `locate`, not the cached one: the same data can sit on a different line after an edit.
  if (cached !== undefined && cached.hash === entryHash) {
    profile?.reuse("transform");

    return { document: { ...cached.document, locate } };
  }

  // Awaited apart from the call, like `transform`.
  const validating = timed(profile, "validate", () =>
    validate(entry, metadata, collection.schema, locate)
  );

  const validated = await validating;

  if (validated.issues) {
    return {
      errors: validated.issues.map((issue) => new ContentError(subject, issue)),
    };
  }

  if (broken) {
    return { errors: [] };
  }

  const { source } = validated;

  let transformed: Transformed;

  try {
    transformed = await transformSource(name, collection, source, {
      dev,
      profile,
      root,
    });
  } catch (error) {
    return failure(error);
  }

  const document = {
    ...transformed,
    file,
    locate,
    setsSlug: isPlainObject(metadata) && "slug" in metadata,
    slug: source.slug,
  };

  if (entryHash !== undefined) {
    cache?.set(entry.slug, { document, hash: entryHash });
  }

  return { document };
}

export {
  type BuiltDocument,
  type CollectionResult,
  type EntryCache,
  loadCollection,
  type WatchGroup,
};
