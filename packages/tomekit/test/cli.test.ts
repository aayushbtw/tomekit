import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { run } from "../src/cli";
import type { CliLogger } from "../src/cli";
import { createProject, SOURCE } from "./project";

const config = `
import { z } from "zod";
import { defineConfig, directory } from ${JSON.stringify(SOURCE)};

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts"),
      schema: z.strictObject({ title: z.string() }),
    },
  },
});
`;

const HELLO = "---\ntitle: Hello\n---\n";

let cleanup: (() => Promise<void>) | undefined;

// Stops each test's `watch`.
let controller = new AbortController();

afterEach(async () => {
  controller.abort();
  controller = new AbortController();
  await cleanup?.();
});

function recorder() {
  const lines: string[] = [];

  function record(message: string) {
    lines.push(message);
  }

  const logger: CliLogger = { error: record, info: record, warn: record };

  return { lines, logger };
}

async function setup(files: Record<string, string>) {
  const project = await createProject({
    "tomekit.config.ts": config,
    ...files,
  });

  ({ cleanup } = project);

  return project;
}

interface Posts {
  slugs: () => readonly string[];
}

function hasPosts(module: unknown): module is { posts: Posts } {
  // A module namespace has no prototype, so `instanceof Object` is false for it.
  return "posts" in Object(module);
}

// Evaluated by Node, not Vite, as a script outside the plugin would.
async function importModule(root: string) {
  const code = await readFile(
    path.join(root, ".tomekit", "content.js"),
    "utf-8"
  );

  const module: unknown = await import(
    /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(code)}`
  );

  if (!hasPosts(module)) {
    throw new Error(".tomekit/content.js has no posts export");
  }

  return module.posts;
}

describe("tomekit build", () => {
  it("writes a module that serves the collections, and its types", async () => {
    const { root } = await setup({ "content/posts/hello.md": HELLO });
    const { lines, logger } = recorder();

    expect(await run(["build"], { logger, root })).toBe(0);
    expect((await importModule(root)).slugs()).toStrictEqual(["hello"]);
    expect(
      await readFile(path.join(root, ".tomekit", "content.d.ts"), "utf-8")
    ).toContain('  "posts": "hello";');
    expect(lines.join("\n")).toContain("[tomekit] built .tomekit/content.js");
  });

  it("fails with every broken file", async () => {
    const { root } = await setup({
      "content/posts/a.md": "---\ntitel: A\n---\n",
      "content/posts/b.md": "---\ntitle: 1\n---\n",
    });

    const { lines, logger } = recorder();

    expect(await run(["build"], { logger, root })).toBe(1);
    expect(lines.join("\n")).toContain(
      "[tomekit] 2 content files have errors:"
    );
  });

  it("reads the config from --config", async () => {
    const { root } = await setup({
      "content/posts/hello.md": HELLO,
      "settings/tomekit.config.ts": config,
      "tomekit.config.ts": "throw new Error('read the wrong config');\n",
    });

    const { logger } = recorder();

    expect(
      await run(["build", "--config", "settings/tomekit.config.ts"], {
        logger,
        root,
      })
    ).toBe(0);
  });

  it("shows the usage for an unknown command", async () => {
    const { lines, logger } = recorder();

    expect(await run(["serve"], { logger, root: "/" })).toBe(1);
    expect(lines.join("\n")).toContain('Unknown command "serve".');
    expect(lines.join("\n")).toContain("Usage: tomekit <command>");
  });
});

describe("tomekit watch", () => {
  it("rebuilds the module after a file changes", async () => {
    const project = await setup({ "content/posts/hello.md": HELLO });
    const { logger } = recorder();

    expect(
      await run(["watch"], {
        logger,
        root: project.root,
        signal: controller.signal,
      })
    ).toBe(0);

    await project.write({
      "content/posts/later.md": "---\ntitle: Later\n---\n",
    });

    await expect
      .poll(async () => (await importModule(project.root)).slugs())
      .toStrictEqual(["hello", "later"]);
  });
});
