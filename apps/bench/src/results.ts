import { readFile } from "node:fs/promises";
import type { CpuInfo } from "node:os";
import path from "node:path";

import type { ScenarioRun } from "./breakdown.ts";

/** Saved profiles, one folder per machine, since timings only compare on the same one. */
const RESULTS = path.resolve(import.meta.dirname, "..", "results");

/** What `profile.ts` saves: every sample of every scenario it ran. */
interface SavedRun {
  commit: string;
  node: string;
  scenarios: Record<string, ScenarioRun>;
  size: number;
}

/** A folder name for this machine, eg `apple-m2-pro-x12`. */
function machine(cpus: readonly CpuInfo[]): string {
  return `${cpus[0]?.model ?? "unknown"} x${cpus.length}`
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
}

function isSavedRun(value: unknown): value is SavedRun {
  return (
    value instanceof Object &&
    "commit" in value &&
    "scenarios" in value &&
    "size" in value
  );
}

async function readRun(file: string): Promise<SavedRun> {
  const run: unknown = JSON.parse(await readFile(file, "utf-8"));

  if (!isSavedRun(run)) {
    throw new TypeError(`${file} is not a saved profile run`);
  }

  return run;
}

export { machine, readRun, RESULTS, type SavedRun };
