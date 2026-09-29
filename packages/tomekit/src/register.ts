import * as nodeModule from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { ContentBuilder, MODULE_ID, OUTPUT } from "./builder";
import { BrokenContentError } from "./errors";
import { contentHooks } from "./hooks";

const root = process.cwd();

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
      import.meta.resolve(MODULE_ID),
      pathToFileURL(path.join(root, OUTPUT, "content.js")).href
    )
  );
}
