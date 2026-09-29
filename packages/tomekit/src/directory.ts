import type { BigIntStats } from "node:fs";
import { glob, readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { Entry, FileInfo, Loader, LoadIssue } from "./index";
import { parse } from "./parse";
import type { LocatedEntry } from "./parse";
import { isProfiled, PROFILE, timed } from "./profile";
import type { PhaseRecorder } from "./profile";

const DEFAULT_FILES = "**/*.md";

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

/** A file matched by the globs, relative to the directory. */
interface Found {
  file: string;
  /** `undefined` when it can't be stat'ed, so reading it reports why. */
  stats: BigIntStats | undefined;
}

/** A file's entry as `parse` returned it, or why it couldn't be read. */
interface FileResult {
  entry: LocatedEntry | undefined;
  /** Relative to the root. */
  filePath: string;
  issues: LoadIssue[];
}

async function filesIn(
  directory: string,
  include: readonly string[],
  exclude: readonly string[] = []
): Promise<Found[]> {
  const matches: string[] = [];

  for await (const match of glob(include, { cwd: directory, exclude })) {
    matches.push(match);
  }

  // Globs match folders too, eg `archive.md/`. `stat` follows symlinks, so a linked file still loads.
  const found = await Promise.all(
    matches.map(async (file) => {
      try {
        const stats = await stat(path.join(directory, file), { bigint: true });

        return stats.isFile() ? [{ file, stats }] : [];
      } catch {
        return [{ file, stats: undefined }];
      }
    })
  );

  return found.flat().toSorted((a, b) => (a.file < b.file ? -1 : 1));
}

/**
 * Each file's last result, reused while its size and times are unchanged, so
 * an edit in dev reads and parses only the files that changed.
 */
class ParseCache {
  #results = new Map<string, { result: FileResult; version: string }>();

  async results(
    directory: string,
    root: string,
    files: readonly Found[],
    profile?: PhaseRecorder
  ): Promise<FileResult[]> {
    const next = new Map<string, { result: FileResult; version: string }>();

    const results = await Promise.all(
      files.map(async ({ file, stats }) => {
        // ctime too: it changes on every write, even one that keeps the mtime.
        const version =
          stats === undefined
            ? undefined
            : `${stats.size}:${stats.mtimeNs}:${stats.ctimeNs}`;

        // With the root, since one loader can load from several roots and `filePath` is relative to it.
        const key = `${root}\0${path.join(directory, file)}`;
        const cached = this.#results.get(key);

        if (version !== undefined && cached?.version === version) {
          next.set(key, cached);
          profile?.reuse("parse");

          return cached.result;
        }

        const result = await read(directory, root, file, profile);

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

async function read(
  directory: string,
  root: string,
  file: string,
  profile?: PhaseRecorder
): Promise<FileResult> {
  const filePath = path.relative(root, path.join(directory, file));

  try {
    const text = await readFile(path.join(directory, file), "utf-8");

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

  return {
    async load(context) {
      const { collection, root, watch } = context;
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

      const results = await cache.results(absolute, root, found, profile);

      const entries: Entry<FileInfo>[] = [];
      const issues: LoadIssue[] = [];

      for (const result of results) {
        if (result.entry !== undefined) {
          entries.push(result.entry);
        }

        issues.push(
          ...result.issues.map((issue) => ({ ...issue, file: result.filePath }))
        );
      }

      return { entries, issues };
    },
  };
}

export { directory, type DirectoryOptions, type Glob };
