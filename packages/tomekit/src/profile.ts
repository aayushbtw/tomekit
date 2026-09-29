import type { LoadContext } from "./index";

const ENV = "TOMEKIT_PROFILE";

/** The `performance.measure` name each profiled build is recorded under. */
const MEASURE = "tomekit";

/** Symbol.for, since the config's copy of tomekit, which runs `directory()`, differs from the builder's. */
const PROFILE = Symbol.for("tomekit.profile");

/** Parts of a build that run one after another, so their times add up to the build's. */
const STAGES = [
  "config",
  "collections",
  "references",
  "generate",
  "write",
] as const;

/** Work inside `collections`. Entries and collections run in parallel, so each is CPU time summed over them. */
const PHASES = ["parse", "validate", "transform", "serialize", "hash"] as const;

type Stage = (typeof STAGES)[number];

type Phase = (typeof PHASES)[number];

interface PhaseTime {
  ms: number;
  /** Files or entries reused from the last build. */
  reused: number;
  /** Files parsed, or entries transformed. */
  runs: number;
}

interface StageData {
  ms: number;
  name: Stage;
}

interface PhaseData extends PhaseTime {
  name: Phase;
}

/** A profile as plain data, for `performance.measure`'s `detail`. Arrays, so readers get stages and phases in the order they run. */
interface ProfileData {
  documents: number;
  ms: number;
  phases: PhaseData[];
  stages: StageData[];
}

/** What `directory()` records into, through `LoadContext[PROFILE]`. */
interface PhaseRecorder {
  reuse: (phase: Phase) => void;
  run: (phase: Phase) => void;
  time: <T>(phase: Phase, work: () => T) => T;
}

function isProfiling(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[ENV];

  return value !== undefined && value !== "" && value !== "0";
}

function isProfiled(
  context: LoadContext
): context is LoadContext & { readonly [PROFILE]: PhaseRecorder } {
  return PROFILE in context;
}

/** Runs `work`, adding its synchronous time to `phase` when there is a profile. */
function timed<T>(
  profile: PhaseRecorder | undefined,
  phase: Phase,
  work: () => T
): T {
  return profile === undefined ? work() : profile.time(phase, work);
}

function phaseTime(): PhaseTime {
  return { ms: 0, reused: 0, runs: 0 };
}

function ms(value: number): string {
  return `${value.toFixed(1).padStart(8)} ms`;
}

const COUNTED: Partial<Record<Phase, string>> = {
  parse: "files",
  transform: "entries",
};

function countOf({ name, reused, runs }: PhaseData): string {
  const what = COUNTED[name];

  if (what === undefined) {
    return "";
  }

  return reused === 0
    ? `  ${runs} ${what}`
    : `  ${runs} ${what}, ${reused} reused`;
}

function sum(values: readonly { ms: number }[]): number {
  return values.reduce((total, value) => total + value.ms, 0);
}

/**
 * Where one build's time went. Stages are wall time and add up to the total;
 * phases are the synchronous time spent in each, so what they leave of
 * `collections` is waiting on files and code after an `await`.
 */
class Profile implements PhaseRecorder {
  readonly #started = performance.now();
  #lap = this.#started;
  #documents = 0;
  #ended: number | undefined;
  readonly #stages: Record<Stage, number> = {
    collections: 0,
    config: 0,
    generate: 0,
    references: 0,
    write: 0,
  };
  readonly #phases: Record<Phase, PhaseTime> = {
    hash: phaseTime(),
    parse: phaseTime(),
    serialize: phaseTime(),
    transform: phaseTime(),
    validate: phaseTime(),
  };

  time<T>(phase: Phase, work: () => T): T {
    const started = performance.now();

    try {
      return work();
    } finally {
      this.#phases[phase].ms += performance.now() - started;
    }
  }

  run(phase: Phase) {
    this.#phases[phase].runs += 1;
  }

  reuse(phase: Phase) {
    this.#phases[phase].reused += 1;
  }

  /** Ends `stage`, which started where the last one ended. */
  lap(stage: Stage) {
    const now = performance.now();
    this.#stages[stage] += now - this.#lap;
    this.#lap = now;
  }

  /** Ends the build, and records it as a `tomekit` performance measure. */
  end(documents: number) {
    this.#documents = documents;
    this.#ended = performance.now();

    performance.measure(MEASURE, {
      detail: this.toJSON(),
      end: this.#ended,
      start: this.#started,
    });
  }

  toJSON(): ProfileData {
    return {
      documents: this.#documents,
      ms: (this.#ended ?? performance.now()) - this.#started,
      phases: PHASES.map((name) => ({ name, ...this.#phases[name] })),
      stages: STAGES.map((name) => ({ ms: this.#stages[name], name })),
    };
  }

  /** A table of every stage and phase, without the `[tomekit]` prefix. */
  summary(): string {
    const { documents, ms: total, phases, stages } = this.toJSON();

    const work = [
      ...phases.map(
        (phase) =>
          `    ${phase.name.padEnd(12)}${ms(phase.ms)}${countOf(phase)}`
      ),
      `    ${"other".padEnd(12)}${ms(this.#stages.collections - sum(phases))}  reading files, loaders, code after an await`,
    ];

    return [
      `profile of a build of ${documents} documents in ${total.toFixed(1)} ms`,
      ...stages.flatMap((stage) => [
        `  ${stage.name.padEnd(14)}${ms(stage.ms)}`,
        ...(stage.name === "collections" ? work : []),
      ]),
      `  ${"other".padEnd(14)}${ms(total - sum(stages))}`,
      "Stages add up to the total. Indented phases are CPU time summed over entries, and add up to collections.",
    ].join("\n");
  }
}

export {
  ENV,
  isProfiled,
  isProfiling,
  MEASURE,
  type Phase,
  PHASES,
  type PhaseRecorder,
  Profile,
  PROFILE,
  type ProfileData,
  type Stage,
  STAGES,
  timed,
};
