import { glob, readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { Entry, FileInfo, Loader, LoadIssue } from "./index";
import { parse } from "./parse";

const DEFAULT_INCLUDE = "**/*.md";

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
 * directory("content/posts", { exclude: "drafts/**", include: ["**\/*.md", "**\/*.mdx"] })
 * ```
 */
interface DirectoryOptions {
  /** Glob patterns, relative to the directory, of files to leave out, eg `"drafts/**"`. */
  exclude?: Glob | readonly Glob[];
  /**
   * Glob patterns, relative to the directory, of files to load.
   *
   * @default "**\/*.md"
   */
  include?: Glob | readonly Glob[];
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

// `stat` follows symlinks, so a linked file still loads. A path it can't stat counts as a file, so reading it reports why.
async function isFile(file: string): Promise<boolean> {
  const stats = await stat(file).catch(() => null);

  return stats?.isFile() ?? true;
}

async function filesIn(
  directory: string,
  include: readonly string[],
  exclude: readonly string[] = []
): Promise<string[]> {
  const matches: string[] = [];

  for await (const match of glob(include, { cwd: directory, exclude })) {
    matches.push(match);
  }

  // Globs match folders too, eg `archive.md/`.
  const checked = await Promise.all(
    matches.map(async (match) =>
      (await isFile(path.join(directory, match))) ? [match] : []
    )
  );

  return checked.flat().toSorted();
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
 *   loader: directory("content/posts", { exclude: "drafts/**" }),
 *   schema: z.strictObject({ title: z.string() }),
 * }
 * ```
 */
function directory(
  folder: string,
  { exclude = [], include = DEFAULT_INCLUDE }: DirectoryOptions = {}
): Loader<FileInfo> {
  const includes = [include].flat();
  const excludes = [exclude].flat();

  return {
    async load({ collection, root, watch }) {
      // Before any early return, so creating a missing folder still reruns `load`.
      watch([
        ...includes.map((pattern) => path.posix.join(folder, pattern)),
        ...excludes.map((pattern) => `!${path.posix.join(folder, pattern)}`),
      ]);

      const absolute = path.resolve(root, folder);

      const issue = await folderIssue(folder, absolute);

      if (issue !== undefined) {
        return { entries: [], issues: [issue] };
      }

      const files = await filesIn(absolute, includes, excludes);

      if (files.length === 0) {
        const empty = `collections.get(${JSON.stringify(collection)}) is empty`;
        // Node's glob skips dotfiles, so a folder holding only `.gitkeep` counts as empty.
        const { length: others } = await filesIn(absolute, ["**/*"]);

        return {
          entries: [],
          warnings: [
            others === 0
              ? `${collection}: directory "${folder}" has no files, so ${empty}`
              : `${collection}: no files in "${folder}" match ${JSON.stringify(include)}, but it has ${others} other ${others === 1 ? "file" : "files"}, so ${empty}`,
          ],
        };
      }

      const results = await Promise.all(
        files.map(async (file) => {
          const filePath = path.relative(root, path.join(absolute, file));

          try {
            const text = await readFile(path.join(absolute, file), "utf-8");

            return { filePath, ...parse({ file, filePath, text }) };
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);

            return {
              entry: undefined,
              filePath,
              issues: [{ cause: error, message }],
            };
          }
        })
      );

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
