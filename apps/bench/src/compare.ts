import { cpus } from "node:os";
import path from "node:path";

import { breakdown, median, ms } from "./breakdown.ts";
import { machine, readRun, RESULTS } from "./results.ts";

function delta(before: number, after: number): string {
  const change = after - before;
  const sign = change > 0 ? "+" : "";

  const percent =
    before === 0 ? "" : ` (${sign}${Math.round((change / before) * 100)}%)`;

  return `${sign}${ms(change)}${percent}`;
}

const [from, to, size = "1000"] = process.argv.slice(2);

if (from === undefined || to === undefined) {
  throw new TypeError("usage: compare.ts <commit> <commit> [size]");
}

const folder = path.join(RESULTS, machine(cpus()));

const before = await readRun(path.join(folder, `${from}-${size}.json`));

const after = await readRun(path.join(folder, `${to}-${size}.json`));

for (const [scenario, run] of Object.entries(after.scenarios)) {
  const previous = before.scenarios[scenario];

  if (previous === undefined) {
    continue;
  }

  const old = new Map(breakdown(previous).map((line) => [line.label, line]));

  const lines = breakdown(run).map(({ cold, dev, label, warm }) => {
    const was = old.get(label);

    const columns = [
      [was?.cold, cold],
      [was?.warm, warm],
      [was?.dev, dev],
    ].map(([previousValues = [], values = []]) => {
      const earlier = median(previousValues);
      const now = median(values);

      return `${ms(earlier)} → ${ms(now)} | ${delta(earlier, now)}`;
    });

    return `| ${label.replaceAll(" ", "&nbsp;")} | ${columns.join(" | ")} |`;
  });

  console.log(
    [
      `### ${size} files, ${scenario}: ${from} → ${to}`,
      "",
      "| | Cold build | Change | Warm build | Change | Dev update | Change |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      ...lines,
      "",
    ].join("\n")
  );
}
