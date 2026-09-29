import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { breakdown, median, ms, spread } from "./breakdown.ts";
import type { ScenarioRun } from "./breakdown.ts";
import { fixture, SCENARIOS } from "./fixtures.ts";
import type { Scenario } from "./fixtures.ts";
import { machine, RESULTS } from "./results.ts";
import { isResult } from "./tools.ts";
import type { Mode, Result } from "./tools.ts";

const run = promisify(execFile);

const MEASURE = path.join(import.meta.dirname, "measure.ts");

const COLD_SAMPLES = 5;

async function sample(
  root: string,
  scenario: Scenario,
  mode: Mode
): Promise<Result> {
  const { stdout } = await run(
    process.execPath,
    [MEASURE, "tomekit", mode, scenario],
    {
      cwd: root,
      env: { ...process.env, TOMEKIT_PROFILE: "1" },
      maxBuffer: 64 * 1024 * 1024,
    }
  );

  const result: unknown = JSON.parse(stdout.trim().split("\n").at(-1) ?? "");

  if (!isResult(result)) {
    throw new TypeError(`tomekit ${mode} printed no result:\n${stdout}`);
  }

  return result;
}

function table(size: number, scenario: Scenario, scenarioRun: ScenarioRun) {
  const lines = breakdown(scenarioRun).map(
    ({ cold, dev, label }) =>
      `| ${label.replaceAll(" ", "&nbsp;")} | ${ms(median(cold))} | ±${ms(spread(cold))} | ${ms(median(dev))} | ±${ms(spread(dev))} |`
  );

  return [
    `### ${size} files, ${scenario}`,
    "",
    `Medians of ${scenarioRun.cold.length} cold builds and ${scenarioRun.dev.updates?.length ?? 0} dev updates; ± is half the range. \`total\` is what the bench measured, \`rest\` is that minus tomekit's build: Vite, and in dev the watcher and the reload.`,
    "",
    "| | Cold build | ± | Dev update | ± |",
    "| --- | --- | --- | --- | --- |",
    ...lines,
    "",
  ].join("\n");
}

async function commit(): Promise<string> {
  const { stdout: sha } = await run("git", ["rev-parse", "--short", "HEAD"]);
  const { stdout: status } = await run("git", ["status", "--porcelain"]);

  return `${sha.trim()}${status.trim() === "" ? "" : "-dirty"}`;
}

const [size = "1000", ...names] = process.argv.slice(2);

const scenarios = SCENARIOS.filter(
  (scenario) => names.length === 0 || names.includes(scenario)
);

const scenarioRuns: Partial<Record<Scenario, ScenarioRun>> = {};

for (const scenario of scenarios) {
  const root = await fixture(Number(size), scenario);
  const cold: Result[] = [];

  // One after another: parallel samples would compete for the CPU.
  for (let index = 0; index < COLD_SAMPLES; index += 1) {
    cold.push(await sample(root, scenario, "cold"));
  }

  const dev = await sample(root, scenario, "dev");
  scenarioRuns[scenario] = { cold, dev };
  console.log(table(Number(size), scenario, { cold, dev }));
}

const sha = await commit();

const file = path.join(RESULTS, machine(cpus()), `${sha}-${size}.json`);

await mkdir(path.dirname(file), { recursive: true });

await writeFile(
  file,
  `${JSON.stringify({ commit: sha, node: process.version, scenarios: scenarioRuns, size: Number(size) }, null, 2)}\n`
);

console.log(`Saved ${path.relative(process.cwd(), file)}`);
