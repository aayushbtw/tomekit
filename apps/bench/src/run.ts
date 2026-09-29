import { execFile } from "node:child_process";
import { cpus, totalmem } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { fixture, SCENARIOS } from "./fixtures.ts";
import type { Scenario } from "./fixtures.ts";
import { TOOLS } from "./tools.ts";
import type { Mode, Result, Tool } from "./tools.ts";

const run = promisify(execFile);

const MEASURE = path.join(import.meta.dirname, "measure.ts");

interface Row {
  cold: Result[];
  dev: Result;
  tool: Tool;
  warm: Result[];
}

function isResult(value: unknown): value is Result {
  return value instanceof Object && "ms" in value && "documents" in value;
}

/** Each sample runs in its own process, so no tool keeps a cache or a watcher from the last one. */
async function sample(
  root: string,
  scenario: Scenario,
  tool: Tool,
  mode: Mode
): Promise<Result> {
  const { stdout } = await run(
    process.execPath,
    [MEASURE, tool, mode, scenario],
    {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
    }
  );

  const result: unknown = JSON.parse(stdout.trim().split("\n").at(-1) ?? "");

  if (!isResult(result)) {
    throw new TypeError(`${tool} ${mode} printed no result:\n${stdout}`);
  }

  return result;
}

async function samples(
  root: string,
  scenario: Scenario,
  tool: Tool,
  mode: Mode,
  count: number
): Promise<Result[]> {
  const results: Result[] = [];

  // One after another: parallel samples would compete for the CPU.
  for (let index = 0; index < count; index += 1) {
    results.push(await sample(root, scenario, tool, mode));
  }

  return results;
}

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function ms(value: number): string {
  if (!Number.isFinite(value)) {
    return "timed out";
  }

  return value >= 1000
    ? `${(value / 1000).toFixed(2)} s`
    : `${Math.round(value)} ms`;
}

function table(size: number, scenario: Scenario, rows: readonly Row[]): string {
  const lines = rows.map(({ cold, dev, tool, warm }) => {
    const counts = new Set(
      [...cold, ...warm, dev].map((result) => result.documents)
    );

    const documents =
      counts.size === 1 && counts.has(size)
        ? ""
        : ` (docs: ${[...counts].join("/")})`;

    const failures =
      (dev.failures ?? 0) > 0 ? ` (${dev.failures} failed imports)` : "";

    return `| ${tool}${documents} | ${ms(median(cold.map((result) => result.ms)))} | ${ms(median(warm.map((result) => result.ms)))} | ${ms(dev.ms)} | ${ms(median(dev.updates ?? []))}${failures} | ${Math.max(...cold.map((result) => result.memory))} MB | ${cold[0]?.output ?? 0} KB |`;
  });

  return [
    `### ${size} files, ${scenario}`,
    "",
    "| Tool | Cold build | Warm build | Dev start | Dev update | Peak memory | Output |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...lines,
    "",
  ].join("\n");
}

const sizes = process.argv.slice(2).map(Number);

const SIZES = sizes.length > 0 ? sizes : [1000, 10_000];

console.log(
  `Node ${process.version}, ${cpus()[0]?.model ?? "unknown CPU"} x${cpus().length}, ${Math.round(totalmem() / 1024 ** 3)} GB\n`
);

for (const size of SIZES) {
  const count = size > 1000 ? 3 : 5;

  for (const scenario of SCENARIOS) {
    const root = await fixture(size, scenario);
    const rows: Row[] = [];

    for (const tool of TOOLS) {
      const cold = await samples(root, scenario, tool, "cold", count);
      const warm = await samples(root, scenario, tool, "warm", count);
      const dev = await sample(root, scenario, tool, "dev");
      rows.push({ cold, dev, tool, warm });
    }

    console.log(table(size, scenario, rows));
  }
}
