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

// oxlint-disable-next-line typescript/strict-void-return -- `promisify` types its callback as returning void; `execFile` also returns its child process.
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
    ({ cold, dev, label, warm }) =>
      `| ${label.replaceAll(" ", "&nbsp;")} | ${ms(median(cold))} | ±${ms(spread(cold))} | ${ms(median(warm))} | ±${ms(spread(warm))} | ${ms(median(dev))} | ±${ms(spread(dev))} |`
  );

  return [
    `### ${size} files, ${scenario}`,
    "",
    `Medians of ${scenarioRun.cold.length} cold builds, ${scenarioRun.warm?.length ?? 0} warm builds and ${scenarioRun.dev.updates?.length ?? 0} dev updates; ± is half the range. \`total\` is what the bench measured, \`rest\` is that minus tomekit's build: Vite, and in dev the watcher and the reload.`,
    "",
    "| | Cold build | ± | Warm build | ± | Dev update | ± |",
    "| --- | --- | --- | --- | --- | --- | --- |",
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

  const warm: Result[] = [];

  // After the cold builds, so the first warm build finds the last cold one's `.tomekit`.
  for (let index = 0; index < COLD_SAMPLES; index += 1) {
    warm.push(await sample(root, scenario, "warm"));
  }

  const dev = await sample(root, scenario, "dev");
  scenarioRuns[scenario] = { cold, dev, warm };
  console.log(table(Number(size), scenario, { cold, dev, warm }));
}

const sha = await commit();

const file = path.join(RESULTS, machine(cpus()), `${sha}-${size}.json`);

await mkdir(path.dirname(file), { recursive: true });

await writeFile(
  file,
  `${JSON.stringify({ commit: sha, node: process.version, scenarios: scenarioRuns, size: Number(size) }, null, 2)}\n`
);

console.log(`Saved ${path.relative(process.cwd(), file)}`);
