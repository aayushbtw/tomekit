import { statSync, watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import path from "node:path";

/** Collects changes this long before reporting them, so a save that touches several files rebuilds once. */
const SETTLE_MS = 20;

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

  /** Watches exactly these paths from now on, eg a builder's `watchFiles` after each build. Paths that don't exist are skipped. */
  watch(paths: readonly string[]) {
    const wanted = new Map<string, { folder: string; recursive: boolean }>();

    for (const file of paths) {
      let folder: boolean;

      try {
        folder = statSync(file).isDirectory();
      } catch {
        continue;
      }

      const target = folder ? file : path.dirname(file);
      wanted.set(`${folder}:${target}`, { folder: target, recursive: folder });
    }

    for (const [key, watcher] of this.#watchers) {
      if (!wanted.has(key)) {
        watcher.close();
        this.#watchers.delete(key);
      }
    }

    for (const [key, { folder, recursive }] of wanted) {
      if (!this.#watchers.has(key)) {
        this.#watchers.set(
          key,
          watch(folder, { recursive }, (_event, name) => {
            this.#add(name === null ? folder : path.join(folder, name));
          })
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

export { FileWatcher };
