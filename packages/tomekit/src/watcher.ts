import { statSync, watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import path from "node:path";

import type { WatchTarget } from "./builder";

/** Collects changes this long before reporting them, so a save that touches several files rebuilds once. */
const SETTLE_MS = 20;

const DOT_SEGMENT = /(?:^|[\\/])\./u;

/** Whether `name`, relative to `folder`, is in a dot folder, which `glob` never loads from, or is left out by a pattern. */
function ignored(
  folder: string,
  name: string,
  patterns: readonly string[]
): boolean {
  const file = path.join(folder, name);

  // A folder never matches its own `folder/**`, so that is checked without the `/**`.
  return (
    DOT_SEGMENT.test(name) ||
    patterns.some(
      (pattern) =>
        path.matchesGlob(file, pattern) ||
        (pattern.endsWith("/**") &&
          path.matchesGlob(file, pattern.slice(0, -"/**".length)))
    )
  );
}

/**
 * Watches files and folders, and reports the absolute paths that changed in
 * one batch. A folder is watched with everything under it; a file through its
 * folder, so an editor that replaces the file on save is still seen.
 */
class FileWatcher {
  readonly #onChange: (files: readonly string[]) => void;
  /** Keyed by folder, plus whether it is watched recursively. */
  readonly #watchers = new Map<string, FSWatcher>();
  readonly #changed = new Set<string>();
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(onChange: (files: readonly string[]) => void) {
    this.#onChange = onChange;
  }

  /** Watches exactly these targets from now on, eg a builder's `watchTargets` after each build. Paths that don't exist are skipped. */
  watch(targets: readonly WatchTarget[]) {
    const wanted = new Map<
      string,
      { folder: string; ignore: readonly string[]; recursive: boolean }
    >();

    for (const { ignore, path: file } of targets) {
      let folder: boolean;

      try {
        folder = statSync(file).isDirectory();
      } catch {
        continue;
      }

      const target = folder ? file : path.dirname(file);

      // With `ignore`, so a change to the patterns starts a watcher that skips the new set.
      wanted.set(`${folder}:${target}:${JSON.stringify(ignore)}`, {
        folder: target,
        ignore: folder ? ignore : [],
        recursive: folder,
      });
    }

    for (const [key, watcher] of this.#watchers) {
      if (!wanted.has(key)) {
        watcher.close();
        this.#watchers.delete(key);
      }
    }

    for (const [key, { folder, ignore, recursive }] of wanted) {
      if (!this.#watchers.has(key)) {
        this.#watchers.set(
          key,
          watch(
            folder,
            {
              // On Linux, Node doesn't watch an ignored folder at all, eg `node_modules`.
              ignore: recursive
                ? (name) => ignored(folder, name, ignore)
                : undefined,
              recursive,
            },
            (_event, name) => {
              this.#add(name === null ? folder : path.join(folder, name));
            }
          )
        );
      }
    }
  }

  close() {
    clearTimeout(this.#timer);

    for (const watcher of this.#watchers.values()) {
      watcher.close();
    }

    this.#watchers.clear();
  }

  #add(file: string) {
    this.#changed.add(file);
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      const files = [...this.#changed];
      this.#changed.clear();
      this.#onChange(files);
    }, SETTLE_MS);
  }
}

export { FileWatcher, ignored };
