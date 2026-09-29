import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import contentCollections from "@content-collections/vite";
import { tomekit } from "tomekit/vite";
import { build as velite } from "velite";
import { build, createServer, isRunnableDevEnvironment } from "vite";
import type { Plugin, RunnableDevEnvironment } from "vite";

import { isMode, isTool, MODES, TOOLS } from "./tools.ts";
import type { Mode, Result, Tool } from "./tools.ts";

interface Post {
  body: string;
  title: string;
}

/** What each tool writes, so a cold run starts without it. */
const OUTPUTS: Record<Tool, string> = {
  "content-collections": ".content-collections",
  tomekit: ".tomekit",
  velite: ".velite",
};

const EDITS = 10;

const TIMEOUT = 30_000;

const EDITED = "content/posts/post-00000.md";

function isPost(value: unknown): value is Post {
  return (
    value instanceof Object &&
    "title" in value &&
    new Object(value.title) instanceof String
  );
}

function isPosts(value: unknown): value is Post[] {
  return Array.isArray(value) && value.every(isPost);
}

function isModule(value: unknown): value is { default: unknown } {
  // Not `instanceof Object`: module namespaces have a null prototype.
  return Object.hasOwn(new Object(value), "default");
}

function assertEntry(module: unknown): asserts module is { default: Post[] } {
  if (!isModule(module) || !isPosts(module.default)) {
    throw new TypeError("the entry's default export is not a list of posts");
  }
}

/** Velite has no Vite plugin; its docs run `build()` next to the dev server, which this does from `buildStart`. */
function velitePlugin(dev: boolean): Plugin {
  let started: Promise<unknown> | undefined;

  return {
    async buildStart() {
      started ??= velite({ clean: !dev, logLevel: "silent", watch: dev });
      await started;
    },
    name: "velite",
  };
}

function pluginsFor(tool: Tool, dev: boolean): Plugin[] {
  switch (tool) {
    case "tomekit": {
      return [tomekit()];
    }

    case "content-collections": {
      return [contentCollections()];
    }

    case "velite": {
      return [velitePlugin(dev)];
    }

    default: {
      throw new TypeError(`unknown tool ${String(tool)}`);
    }
  }
}

async function sizeOf(folder: string): Promise<number> {
  const files = await readdir(folder, { recursive: true, withFileTypes: true });

  const sizes = await Promise.all(
    files.map(async (file) =>
      file.isFile()
        ? (await stat(path.join(file.parentPath, file.name))).size
        : 0
    )
  );

  return sizes.reduce((total, size) => total + size, 0);
}

function memory(): number {
  return Math.round(process.resourceUsage().maxRSS / 1024);
}

async function measureBuild(tool: Tool): Promise<Result> {
  const outDir = path.resolve("dist", tool);
  const start = performance.now();

  await build({
    build: {
      emptyOutDir: true,
      minify: false,
      outDir,
      ssr: `entry-${tool}.ts`,
    },
    configFile: false,
    logLevel: "silent",
    plugins: pluginsFor(tool, false),
    publicDir: false,
    root: process.cwd(),
  });

  const ms = performance.now() - start;
  const bundle = pathToFileURL(path.join(outDir, `entry-${tool}.js`));
  const entry: unknown = await import(bundle.href);
  assertEntry(entry);
  const posts = entry.default;

  return {
    documents: posts.length,
    memory: memory(),
    ms,
    output: Math.round((await sizeOf(outDir)) / 1024),
  };
}

async function postsFrom(
  environment: RunnableDevEnvironment,
  tool: Tool
): Promise<Post[]> {
  const entry: unknown = await environment.runner.import(`/entry-${tool}.ts`);
  assertEntry(entry);

  return entry.default;
}

interface Served {
  /** Imports that threw, eg on a generated file read while half written. */
  failures: number;
  served: boolean;
}

async function served(
  environment: RunnableDevEnvironment,
  tool: Tool,
  title: string
): Promise<Served> {
  const deadline = performance.now() + TIMEOUT;
  let failures = 0;

  while (performance.now() < deadline) {
    try {
      const posts = await postsFrom(environment, tool);

      if (posts.some((post) => post.title === title)) {
        return { failures, served: true };
      }
    } catch {
      failures += 1;
    }

    await wait(5);
  }

  return { failures, served: false };
}

async function measureDev(tool: Tool): Promise<Result> {
  const start = performance.now();

  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    plugins: pluginsFor(tool, true),
    root: process.cwd(),
    server: { middlewareMode: true },
  });

  const environment = server.environments.ssr;

  if (!isRunnableDevEnvironment(environment)) {
    throw new TypeError("the ssr environment can't run modules");
  }

  const posts = await postsFrom(environment, tool);
  const ms = performance.now() - start;
  const original = await readFile(EDITED, "utf-8");
  const updates: number[] = [];
  let failures = 0;

  try {
    for (let edit = 1; edit <= EDITS; edit += 1) {
      // Lets watchers settle, so each edit is measured on its own.
      await wait(300);
      const title = `Edited ${edit}`;
      const written = performance.now();
      await writeFile(
        EDITED,
        original.replace(/^title: .*$/mu, `title: ${title}`)
      );

      const result = await served(environment, tool, title);
      failures += result.failures;

      updates.push(
        result.served ? performance.now() - written : Number.POSITIVE_INFINITY
      );
    }
  } finally {
    await writeFile(EDITED, original);
    await server.close();
  }

  return { documents: posts.length, failures, memory: memory(), ms, updates };
}

async function measure(tool: Tool, mode: Mode): Promise<Result> {
  if (mode !== "warm") {
    await rm(OUTPUTS[tool], { force: true, recursive: true });
  }

  return mode === "dev" ? measureDev(tool) : measureBuild(tool);
}

const [tool = "", mode = ""] = process.argv.slice(2);

if (!isTool(tool) || !isMode(mode)) {
  throw new TypeError(
    `usage: measure.ts <${TOOLS.join("|")}> <${MODES.join("|")}>`
  );
}

const result = await measure(tool, mode);

// The runner reads the last line; tools may log before it.
console.log(JSON.stringify(result));

// Watchers from velite and content-collections keep the process alive.
process.exit(0);
