import { execFile } from "node:child_process";
import { cpus, totalmem } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { median, ms } from "./breakdown.ts";
import { fixture, SCENARIOS } from "./fixtures.ts";
import type { Scenario } from "./fixtures.ts";
import { isResult, TOOLS } from "./tools.ts";
import type { Mode, Result, Tool } from "./tools.ts";

// oxlint-disable-next-line typescript/strict-void-return -- `promisify` types its callback as returning void; `execFile` also returns its child process.
const run = promisify(execFile);

const MEASURE = path.join(import.meta.dirname, "measure.ts");

interface Row {
  cold: Result[];
  dev: Result[];
  tool: Tool;
  warm: Result[];
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

/** Tools take turns, each round starting from the next one, so drift over the run, eg heat or the file cache, favors none of them. */
async function rounds(
  root: string,
  scenario: Scenario,
  mode: Mode,
  count: number
): Promise<Map<Tool, Result[]>> {
  const results = new Map<Tool, Result[]>(TOOLS.map((tool) => [tool, []]));

  // One after another: parallel samples would compete for the CPU.
  for (let round = 0; round < count; round += 1) {
    const first = round % TOOLS.length;

    for (const tool of [...TOOLS.slice(first), ...TOOLS.slice(0, first)]) {
      results.get(tool)?.push(await sample(root, scenario, tool, mode));
    }
  }

  return results;
}

const COLUMNS = ["Cold build", "Warm build", "Dev start", "Dev update"];

function columnsOf({ cold, dev, warm }: Row): number[] {
  return [
    median(cold.map((result) => result.ms)),
    median(warm.map((result) => result.ms)),
    median(dev.map((result) => result.ms)),
    median(dev.flatMap((result) => result.updates ?? [])),
  ];
}

function table(size: number, scenario: Scenario, rows: readonly Row[]): string {
  const values = rows.map(columnsOf);
  const best = COLUMNS.map((_, column) =>
    Math.min(...values.map((row) => row[column] ?? Number.POSITIVE_INFINITY))
  );

  const lines = rows.map((row, index) => {
    const { cold, dev, tool, warm } = row;
    const counts = new Set(
      [...cold, ...warm, ...dev].map((result) => result.documents)
    );

    const documents =
      counts.size === 1 && counts.has(size)
        ? ""
        : ` (docs: ${[...counts].join("/")})`;

    const failed = dev.reduce(
      (total, result) => total + (result.failures ?? 0),
      0
    );
    const failures = failed > 0 ? ` (${failed} failed imports)` : "";

    const cells = (values[index] ?? []).map((value, column) =>
      value === best[column] ? `**${ms(value)}**` : ms(value)
    );

    return `| ${tool}${documents} | ${cells.join(" | ")}${failures} |`;
  });

  return [
    `### ${size} files, ${scenario}`,
    "",
    `| Tool | ${COLUMNS.join(" | ")} |`,
    `| --- |${" --- |".repeat(COLUMNS.length)}`,
    ...lines,
    "",
  ].join("\n");
}

const sizes = process.argv.slice(2).map(Number);

const SIZES = sizes.length > 0 ? sizes : [1000, 10_000];

console.log(
  `Node ${process.version}, ${cpus()[0]?.model ?? "unknown CPU"} x${cpus().length}, ${Math.round(totalmem() / 1024 ** 3)} GB. Medians; lower is better, fastest in bold. Warm builds keep each tool's cache from the build before; dev update is from saving a file until the dev server serves it.\n`
);

for (const size of SIZES) {
  const count = size > 1000 ? 3 : 5;

  for (const scenario of SCENARIOS) {
    const root = await fixture(size, scenario);
    // Warm rounds come after cold ones, so each tool's first warm build finds its last cold build's cache.
    const cold = await rounds(root, scenario, "cold", count);
    const warm = await rounds(root, scenario, "warm", count);
    const dev = await rounds(root, scenario, "dev", count);

    const rows = TOOLS.map((tool) => ({
      cold: cold.get(tool) ?? [],
      dev: dev.get(tool) ?? [],
      tool,
      warm: warm.get(tool) ?? [],
    }));

    console.log(table(size, scenario, rows));
  }
}
