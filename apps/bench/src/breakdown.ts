import type { BuildProfile, Result } from "./tools.ts";

/** What `profile.ts` saves for one scenario: every sample, so a later compare can recompute anything. */
interface ScenarioRun {
  cold: Result[];
  dev: Result;
  /** Builds that keep `.tomekit` from the one before. Missing from runs saved before it was measured. */
  warm?: Result[];
}

/** One line of the breakdown, with a value per sample. */
interface Line {
  cold: number[];
  dev: number[];
  label: string;
  warm: number[];
}

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

/** Half the range, as a plain measure of how much a column moves between samples. */
function spread(values: readonly number[]): number {
  return values.length < 2
    ? 0
    : (Math.max(...values) - Math.min(...values)) / 2;
}

function ms(value: number): string {
  if (!Number.isFinite(value)) {
    return "timed out";
  }

  return value >= 1000
    ? `${(value / 1000).toFixed(2)} s`
    : `${Math.round(value)} ms`;
}

function sum(values: readonly { ms: number }[]): number {
  return values.reduce((total, value) => total + value.ms, 0);
}

/** Each sample's value per label: the bench's total, tomekit's stages and phases, and what is left for Vite. */
function linesOf(
  totals: readonly number[],
  profiles: readonly BuildProfile[],
  rest: string
): Map<string, number[]> {
  if (totals.length !== profiles.length) {
    throw new TypeError(
      `${totals.length} samples but ${profiles.length} profiles. Run with TOMEKIT_PROFILE=1`
    );
  }

  const lines = new Map<string, number[]>();

  function add(label: string, value: number) {
    lines.set(label, [...(lines.get(label) ?? []), value]);
  }

  for (const [index, profile] of profiles.entries()) {
    const total = totals[index] ?? Number.NaN;
    const { phases, stages } = profile;
    add("total", total);
    add("tomekit", profile.ms);

    for (const stage of stages) {
      add(`  ${stage.name}`, stage.ms);

      if (stage.name === "collections") {
        for (const phase of phases) {
          add(`    ${phase.name}`, phase.ms);
        }

        add("    other", stage.ms - sum(phases));
      }
    }

    add("  other", profile.ms - sum(stages));
    add(rest, total - profile.ms);
  }

  return lines;
}

function buildLines(results: readonly Result[]): Map<string, number[]> {
  return linesOf(
    results.map((result) => result.ms),
    results.flatMap((result) => result.profiles?.at(-1) ?? []),
    "rest"
  );
}

/** Cold builds, warm builds and dev updates side by side. `rest` is Vite's part: everything the bench measured outside tomekit's build. */
function breakdown({ cold, dev, warm = [] }: ScenarioRun): Line[] {
  const coldLines = buildLines(cold);
  const warmLines = buildLines(warm);
  const devLines = linesOf(dev.updates ?? [], dev.profiles ?? [], "rest");

  return [
    ...new Set([...coldLines.keys(), ...warmLines.keys(), ...devLines.keys()]),
  ].map((label) => ({
    cold: coldLines.get(label) ?? [],
    dev: devLines.get(label) ?? [],
    label,
    warm: warmLines.get(label) ?? [],
  }));
}

export { breakdown, type Line, median, ms, type ScenarioRun, spread };
