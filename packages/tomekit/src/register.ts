import * as nodeModule from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { ContentBuilder, MODULE_ID, MODULES_ID, OUTPUT } from "./builder";
import { BrokenContentError } from "./errors";
import { contentHooks } from "./hooks";

const root = process.cwd();

function generated(file: string): string {
  return pathToFileURL(path.join(root, OUTPUT, file)).href;
}

const builder = new ContentBuilder({
  configPath: path.join(root, "tomekit.config.ts"),
  dev: false,
  rebuilds: false,
  root,
});

try {
  const build = await builder.load();

  for (const warning of build.warnings) {
    console.warn(`[tomekit] ${warning}`);
  }

  // On stderr, since stdout belongs to the script.
  if (build.profile !== undefined) {
    console.error(`[tomekit] ${build.profile.summary()}`);
  }

  if (build.errors.length > 0) {
    throw new BrokenContentError(build.errors);
  }
} catch (error) {
  console.error(
    `[tomekit] ${error instanceof Error ? error.message : String(error)}`
  );
  // Before the script starts, like a failed `vite build`, and without a stack, which points into tomekit.
  process.exit(1);
}

// Bun has no registerHooks, and needs none: it resolves `tomekit/content` through tsconfig `paths`.
if ("registerHooks" in nodeModule) {
  nodeModule.registerHooks(
    contentHooks(
      new Map([
        [import.meta.resolve(MODULE_ID), generated("content.js")],
        [import.meta.resolve(MODULES_ID), generated("content-modules.js")],
      ])
    )
  );
}
