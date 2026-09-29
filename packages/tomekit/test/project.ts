import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { onTestFinished } from "vite-plus/test";

const TMP = path.join(import.meta.dirname, ".tmp");

async function writeFiles(root: string, files: Record<string, string>) {
  await Promise.all(
    Object.entries(files).map(async ([file, source]) => {
      const target = path.join(root, file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, source);
    })
  );
}

/** A throwaway project inside the repo, so its files resolve this repo's node_modules. */
async function createProject(files: Record<string, string>) {
  await mkdir(TMP, { recursive: true });
  const root = await mkdtemp(path.join(TMP, "project-"));
  await writeFiles(root, files);
  onTestFinished(async () => {
    await rm(root, { force: true, recursive: true });
  });

  return {
    root,
    write: async (more: Record<string, string>) => {
      await writeFiles(root, more);
    },
  };
}

const SOURCE = path.join(import.meta.dirname, "..", "src", "index.ts");

export { createProject, SOURCE };
