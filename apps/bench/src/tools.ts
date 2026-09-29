const TOOLS = ["tomekit", "content-collections", "velite"] as const;

const MODES = ["cold", "warm", "dev"] as const;

type Tool = (typeof TOOLS)[number];

type Mode = (typeof MODES)[number];

/** A stage's or phase's time, as tomekit records it. */
interface Timed {
  ms: number;
  name: string;
}

/** One build's profile: the `detail` of a `tomekit` performance measure, recorded when `TOMEKIT_PROFILE` is set. */
interface BuildProfile {
  documents: number;
  ms: number;
  phases: Timed[];
  stages: Timed[];
}

interface Result {
  /** Documents the output held, to catch a tool that silently dropped some. */
  documents: number;
  /** Dev imports that threw while an edit was being served. */
  failures?: number;
  /** Peak resident memory of the process, in MB. */
  memory: number;
  /** Cold or warm `vite build`, or dev start until the first import returns. */
  ms: number;
  /** tomekit's profile of each build: the one in a cold or warm build, and the last one after each dev edit. */
  profiles?: BuildProfile[];
  /** Size of the `vite build` output, in KB. */
  output?: number;
  /** Each edit's time from writing the file until the dev server serves it. */
  updates?: number[];
}

function isBuildProfile(value: unknown): value is BuildProfile {
  return (
    value instanceof Object &&
    "ms" in value &&
    "phases" in value &&
    "stages" in value
  );
}

function isResult(value: unknown): value is Result {
  return value instanceof Object && "ms" in value && "documents" in value;
}

function isTool(value: string): value is Tool {
  return TOOLS.some((tool) => tool === value);
}

function isMode(value: string): value is Mode {
  return MODES.some((mode) => mode === value);
}

export {
  type BuildProfile,
  isBuildProfile,
  isMode,
  isResult,
  isTool,
  MODES,
  type Mode,
  type Result,
  type Tool,
  TOOLS,
};
