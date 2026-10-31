import type { Dirent } from "node:fs";
import { glob, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { Entry, FileInfo, Loader, LoadIssue } from "./index";
import { isString } from "./kind";
import { parse } from "./parse";
import type { LocatedEntry } from "./parse";
import { isProfiled, PROFILE, timed } from "./profile";
import type { PhaseRecorder } from "./profile";

const DEFAULT_FILES = "**/*.md";

/**
 * Marks a `load` that returns a new entry object whenever an entry's content
 * changes and never changes one it returned. Symbol.for, since the config's
 * copy of tomekit, which runs `directory()`, differs from the builder's.
 */
const STABLE_ENTRIES = Symbol.for("tomekit.stableEntries");

function hasStableEntries(load: Loader["load"]): boolean {
  return STABLE_ENTRIES in load;
}

/**
 * A glob pattern. Suggests common ones and accepts any string.
 *
 * @internal
 */
type Glob = "**/*.md" | "**/*.mdx" | "*.md" | (string & Record<never, never>);

/**
 * Options for {@link directory}.
 *
 * @example
 * ```ts
 * directory("content/posts", { files: ["**\/*.md", "**\/*.mdx", "!drafts/**"] })
 * ```
 */
interface DirectoryOptions {
  /**
   * Glob patterns, relative to the directory, of files to load. A pattern
   * starting with `!` leaves out files the others match, eg `"!drafts/**"`.
   *
   * @default "**\/*.md"
   */
  files?: Glob | readonly Glob[];
}

function isMissing(cause: unknown): boolean {
  return (
    cause instanceof Error &&
    "code" in cause &&
    (cause.code === "ENOENT" || cause.code === "ENOTDIR")
  );
}

/** Why `folder` can't be loaded, or `undefined` when it is a directory. */
async function folderIssue(
  folder: string,
  absolute: string
): Promise<LoadIssue | undefined> {
  try {
    const stats = await stat(absolute);

    return stats.isDirectory()
      ? undefined
      : {
          message: `"${folder}" is a file, not a directory. Pass the folder that holds it, eg \`directory(${JSON.stringify(path.posix.dirname(folder))})\``,
        };
  } catch (error) {
    return isMissing(error)
      ? {
          message: `directory "${folder}" does not exist. Create it, or fix the path passed to \`directory()\``,
        }
      : {
          cause: error,
          message: `directory "${folder}" can't be read: ${error instanceof Error ? error.message : String(error)}`,
        };
  }
}

/** A file's entry as `parse` returned it, or why it couldn't be read. */
interface FileResult {
  entry: LocatedEntry | undefined;
  /** Relative to the root. */
  filePath: string;
  issues: LoadIssue[];
}

interface Match {
  file: string;
  match: Dirent;
}

const EXTENSION_GLOB = /^\*\*\/\*(?<ending>\.[\w.-]+)$/u;

// Like Node's glob, which lowercases both sides on macOS.
const IGNORES_CASE = process.platform === "darwin";

function endingsOf(include: readonly string[]): string[] | undefined {
  const endings = include.map(
    (pattern) => EXTENSION_GLOB.exec(pattern)?.groups?.ending
  );

  return endings.every(isString)
    ? endings.map((ending) => (IGNORES_CASE ? ending.toLowerCase() : ending))
    : undefined;
}

/** What `fs.glob` matches for `**\/*<ending>`: it skips dot names and doesn't enter symlinked folders. */
async function walk(
  absolute: string,
  endings: readonly string[]
): Promise<Match[]> {
  const matches: Match[] = [];

  async function visit(folder: string): Promise<void> {
    let entries: Dirent[];

    try {
      entries = await readdir(`${absolute}/${folder}`, { withFileTypes: true });
    } catch {
      // Like `fs.glob`, which skips a folder it can't read.
      return;
    }

    const below: Promise<void>[] = [];

    for (const match of entries) {
      const { name } = match;

      if (name.startsWith(".")) {
        continue;
      }

      if (match.isDirectory()) {
        below.push(visit(`${folder}${name}/`));
      } else if (
        endings.some((ending) =>
          (IGNORES_CASE ? name.toLowerCase() : name).endsWith(ending)
        )
      ) {
        matches.push({ file: folder + name, match });
      }
    }

    await Promise.all(below);
  }

  await visit("");

  return matches;
}

async function globbed(
  absolute: string,
  include: readonly string[],
  exclude: readonly string[]
): Promise<Match[]> {
  const matches: Match[] = [];

  for await (const match of glob(include, {
    cwd: absolute,
    exclude,
    withFileTypes: true,
  })) {
    matches.push({
      file: path.relative(
        absolute,
        path.resolve(absolute, match.parentPath, match.name)
      ),
      match,
    });
  }

  return matches;
}

async function filesIn(
  absolute: string,
  include: readonly string[],
  exclude: readonly string[] = []
): Promise<string[]> {
  // The walk builds `/` paths and has no `!` patterns, which `fs.glob` also applies to folders.
  const endings =
    process.platform === "win32" || exclude.length > 0
      ? undefined
      : endingsOf(include);

  const matches =
    endings === undefined
      ? await globbed(absolute, include, exclude)
      : await walk(absolute, endings);

  // Globs match folders too, eg `archive.md/`.
  const found = await Promise.all(
    matches.map(async ({ file, match }) => {
      if (!match.isSymbolicLink()) {
        return match.isFile() ? [file] : [];
      }

      try {
        const stats = await stat(path.join(absolute, file));

        return stats.isFile() ? [file] : [];
      } catch {
        return [file];
      }
    })
  );

  return found.flat().toSorted();
}

/** `undefined` when it can't be stat'ed, so reading it reports why. */
async function versionOf(file: string): Promise<string | undefined> {
  try {
    const stats = await stat(file, { bigint: true });

    // ctime too: it changes on every write, even one that keeps the mtime.
    return `${stats.size}:${stats.mtimeNs}:${stats.ctimeNs}`;
  } catch {
    return undefined;
  }
}

interface FoundFile {
  absolute: string;
  file: string;
  filePath: string;
}

/** What `path.join` and `path.relative` give for each file, with those calls made once per folder. */
function foundFiles(
  absolute: string,
  root: string,
  files: readonly string[]
): FoundFile[] {
  const folder = absolute.endsWith(path.sep) ? absolute : absolute + path.sep;
  const relative = path.relative(root, absolute);
  const prefix =
    relative === "" || relative.endsWith(path.sep)
      ? relative
      : relative + path.sep;

  return files.map((file) => ({
    absolute: folder + file,
    file,
    // A folder outside the root can hold the root, where `path.relative` drops the `../`.
    filePath: relative.startsWith("..")
      ? path.relative(root, folder + file)
      : prefix + file,
  }));
}

async function read(
  { absolute, file, filePath }: FoundFile,
  profile?: PhaseRecorder
): Promise<FileResult> {
  try {
    const text = await readFile(absolute, "utf-8");

    const parsed = timed(profile, "parse", () =>
      parse({ file, filePath, text })
    );

    profile?.run("parse");

    return { filePath, ...parsed };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      entry: undefined,
      filePath,
      issues: [{ cause: error, message }],
    };
  }
}

/**
 * Each file's last result, reused while its size and times are unchanged, so
 * an edit in dev reads and parses only the files that changed.
 */
class ParseCache {
  #results = new Map<string, { result: FileResult; version: string }>();

  async results(
    root: string,
    files: readonly FoundFile[],
    profile?: PhaseRecorder
  ): Promise<FileResult[]> {
    const next = new Map<string, { result: FileResult; version: string }>();

    const results = await Promise.all(
      files.map(async (file) => {
        const version = await versionOf(file.absolute);

        // With the root, since one loader can load from several roots and `filePath` is relative to it.
        const key = `${root}\0${file.absolute}`;
        const cached = this.#results.get(key);

        if (version !== undefined && cached?.version === version) {
          next.set(key, cached);
          profile?.reuse("parse");

          return cached.result;
        }

        const result = await read(file, profile);

        // A read error is not cached, so the next load tries again.
        if (version !== undefined && result.entry !== undefined) {
          next.set(key, { result, version });
        }

        return result;
      })
    );

    this.#results = next;

    return results;
  }
}

/**
 * Loads each Markdown file in a directory as an entry: its frontmatter is the
 * metadata and the rest is the body.
 *
 * @remarks
 * The slug is the frontmatter's `slug`, or the file's path inside the
 * directory without the extension, eg `guides/setup`.
 *
 * @param folder Relative to the project root, eg `content/posts`.
 *
 * @example
 * ```ts
 * posts: {
 *   loader: directory("content/posts", { files: ["**\/*.md", "!drafts/**"] }),
 *   schema: z.strictObject({ title: z.string() }),
 * }
 * ```
 */
function directory(
  folder: string,
  { files = DEFAULT_FILES }: DirectoryOptions = {}
): Loader<FileInfo> {
  const patterns = [files].flat();
  const includes = patterns.filter((pattern) => !pattern.startsWith("!"));

  // Passed to `glob` as `exclude`, so they only take away from what the others match, whatever their order.
  const excludes = patterns.flatMap((pattern) =>
    pattern.startsWith("!") ? [pattern.slice(1)] : []
  );

  const cache = new ParseCache();

  const loader: Loader<FileInfo> = {
    async load(context) {
      const { collection, dev, root, watch } = context;
      const profile = isProfiled(context) ? context[PROFILE] : undefined;

      // Before any early return, so creating a missing folder still reruns `load`.
      watch(
        patterns.map((pattern) =>
          pattern.startsWith("!")
            ? `!${path.posix.join(folder, pattern.slice(1))}`
            : path.posix.join(folder, pattern)
        )
      );

      const absolute = path.resolve(root, folder);

      const issue = await folderIssue(folder, absolute);

      if (issue !== undefined) {
        return { entries: [], issues: [issue] };
      }

      const found = await filesIn(absolute, includes, excludes);

      if (found.length === 0) {
        // Node's glob skips dotfiles, so a folder holding only `.gitkeep` counts as empty.
        const { length: others } = await filesIn(absolute, ["**/*"]);

        return {
          entries: [],
          warnings: [
            others === 0
              ? `${collection}: directory "${folder}" has no files, so the collection is empty`
              : `${collection}: no files in "${folder}" match ${JSON.stringify(files)}, but it has ${others} other ${others === 1 ? "file" : "files"}, so the collection is empty`,
          ],
        };
      }

      const located = foundFiles(absolute, root, found);

      // Only dev loads again in the same process, so a build skips the stats the cache needs.
      const results = dev
        ? await cache.results(root, located, profile)
        : await Promise.all(
            located.map(async (file) => await read(file, profile))
          );

      const entries: Entry<FileInfo>[] = [];
      const issues: LoadIssue[] = [];

      for (const result of results) {
        if (result.entry !== undefined) {
          entries.push(result.entry);
        }

        issues.push(
          ...result.issues.map((fileIssue) => ({
            ...fileIssue,
            file: result.filePath,
          }))
        );
      }

      return { entries, issues };
    },
  };

  // On `load`, not the loader, so a wrapper that replaces `load` drops it.
  Object.assign(loader.load, { [STABLE_ENTRIES]: true });

  return loader;
}

export { directory, type DirectoryOptions, type Glob, hasStableEntries };
