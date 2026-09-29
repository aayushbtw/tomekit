import path from "node:path";
import { parseArgs } from "node:util";

import { ContentBuilder, OUTPUT } from "./builder";
import type { Build } from "./builder";
import { BrokenContentError } from "./errors";
import { FileWatcher } from "./watcher";

const USAGE = `Usage: tomekit <command> [--config <file>]

Commands:
  build  Build your collections into ${OUTPUT} once. Fails on broken content.
  watch  Build, then rebuild whenever content or the config changes.

Options:
  --config <file>  The config file, relative to the current folder. Default: tomekit.config.ts`;

const OPTIONS = {
  config: { default: "tomekit.config.ts", type: "string" },
} as const;

interface CliLogger extends Pick<Console, "error" | "info" | "warn"> {}

interface CliOptions {
  logger: CliLogger;
  root: string;
  /** Stops `watch`. Without one, it runs until the process ends. */
  signal?: AbortSignal;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** Logs a build's warnings and errors. Returns whether its content is free of errors. */
function report(build: Build, logger: CliLogger, started: number): boolean {
  for (const warning of build.warnings) {
    logger.warn(`[tomekit] ${warning}`);
  }

  if (build.profile !== undefined) {
    logger.info(`[tomekit] ${build.profile.summary()}`);
  }

  if (build.errors.length > 0) {
    logger.error(`[tomekit] ${new BrokenContentError(build.errors).message}`);

    return false;
  }

  logger.info(
    `[tomekit] built ${OUTPUT}/content.js in ${Math.round(performance.now() - started)} ms`
  );

  return true;
}

async function build(builder: ContentBuilder, logger: CliLogger) {
  const started = performance.now();

  try {
    return report(await builder.load(), logger, started);
  } catch (error) {
    logger.error(`[tomekit] ${errorMessage(error)}`);

    return false;
  }
}

async function watch(
  builder: ContentBuilder,
  { logger, signal }: CliOptions
): Promise<void> {
  const watcher = new FileWatcher((files) => {
    const changed = files.filter((file) => builder.changed(file));

    if (changed.length > 0) {
      void rebuild();
    }
  });

  async function rebuild() {
    await build(builder, logger);
    // After every build, since a `load` can watch different files than the last one.
    watcher.watch(builder.watchTargets);
  }

  signal?.addEventListener("abort", () => {
    watcher.close();
  });

  await rebuild();
}

/**
 * Runs the `tomekit` command with these arguments. Returns the exit code;
 * `watch` returns once its first build is done and keeps watching.
 */
async function run(args: readonly string[], options: CliOptions) {
  const { logger, root } = options;
  const parsed = parseCommand(args);

  if ("issue" in parsed) {
    logger.error(
      parsed.issue === undefined ? USAGE : `${parsed.issue}\n\n${USAGE}`
    );

    return 1;
  }

  const { command, config } = parsed;

  const builder = new ContentBuilder({
    configPath: path.resolve(root, config),
    dev: command === "watch",
    rebuilds: command === "watch",
    root,
  });

  if (command === "watch") {
    await watch(builder, options);

    return 0;
  }

  return (await build(builder, logger)) ? 0 : 1;
}

type Command =
  | { command: "build" | "watch"; config: string }
  /** `undefined` when no command was given, so only the usage is shown. */
  | { issue: string | undefined };

function parseCommand(args: readonly string[]): Command {
  let parsed: ReturnType<
    typeof parseArgs<{ allowPositionals: true; options: typeof OPTIONS }>
  >;

  try {
    parsed = parseArgs({
      allowPositionals: true,
      args: [...args],
      options: OPTIONS,
    });
  } catch (error) {
    return { issue: errorMessage(error) };
  }

  const [command, ...rest] = parsed.positionals;

  if (command === undefined) {
    return { issue: undefined };
  }

  if (command !== "build" && command !== "watch") {
    return { issue: `Unknown command "${command}".` };
  }

  if (rest.length > 0) {
    return { issue: `Unexpected argument "${rest.join(" ")}".` };
  }

  return { command, config: parsed.values.config };
}

export { type CliLogger, type CliOptions, run };
