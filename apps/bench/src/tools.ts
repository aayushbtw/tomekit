const TOOLS = ["tomekit", "content-collections", "velite"] as const;

const MODES = ["cold", "warm", "dev"] as const;

type Tool = (typeof TOOLS)[number];

type Mode = (typeof MODES)[number];

interface Result {
  /** Documents the output held, to catch a tool that silently dropped some. */
  documents: number;
  /** Dev imports that threw while an edit was being served. */
  failures?: number;
  /** Peak resident memory of the process, in MB. */
  memory: number;
  /** Cold or warm `vite build`, or dev start until the first import returns. */
  ms: number;
  /** Size of the `vite build` output, in KB. */
  output?: number;
  /** Each edit's time from writing the file until the dev server serves it. */
  updates?: number[];
}

function isTool(value: string): value is Tool {
  return TOOLS.some((tool) => tool === value);
}

function isMode(value: string): value is Mode {
  return MODES.some((mode) => mode === value);
}

export { isMode, isTool, MODES, type Mode, type Result, type Tool, TOOLS };
