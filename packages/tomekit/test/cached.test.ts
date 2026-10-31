import { access, rm } from "node:fs/promises";
import path from "node:path";

import { build, createLogger, createServer, mergeConfig } from "vite";
import type { InlineConfig, Plugin } from "vite";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { cached } from "../src/cached";
import {
  DuplicateCachedPluginError,
  UncacheablePluginError,
} from "../src/errors";
import { createProject } from "./project";

const VITE = JSON.stringify(
  path.join(import.meta.dirname, "..", "src", "vite.ts")
);

// Counts compiles on `globalThis`, which the Vite config shares with the test even though Vite imports it separately.
const viteConfig = `
import { cached } from ${VITE};
import { suffix } from "./options";

export default {
  plugins: [
    cached({
      enforce: "pre",
      name: "upper",
      transform(code, id) {
        if (!id.endsWith(".mdx")) {
          return undefined;
        }

        globalThis.cachedRuns = (globalThis.cachedRuns ?? 0) + 1;
        if (id.endsWith("watched.mdx")) {
          this.addWatchFile(id);
        }

        const result = { code: \`export default \${JSON.stringify(code.toUpperCase() + suffix)};\\n\`, map: null };
        return id.endsWith("meta.mdx") ? { ...result, meta: { upper: true } } : result;
      },
    }),
  ],
};
`;

declare global {
  var cachedRuns: number | undefined;
}

function runs() {
  return globalThis.cachedRuns ?? 0;
}

async function createApp(files: Record<string, string> = {}) {
  globalThis.cachedRuns = 0;
  onTestFinished(() => {
    globalThis.cachedRuns = 0;
  });

  return await createProject({
    "content/a.mdx": "# a\n",
    "content/b.mdx": "# b\n",
    "options.ts": 'export const suffix = "!";\n',
    "src/main.js":
      'import a from "../content/a.mdx";\nimport b from "../content/b.mdx";\nexport default [a, b];\n',
    "vite.config.ts": viteConfig,
    ...files,
  });
}

function loggerFor(messages: string[]) {
  const logger = createLogger("silent");
  logger.warn = (message) => {
    messages.push(message);
  };

  return logger;
}

async function buildApp(root: string, options: InlineConfig = {}) {
  const messages: string[] = [];
  const output = await build(
    mergeConfig<InlineConfig, InlineConfig>(
      {
        build: {
          rolldownOptions: { input: "src/main.js" },
          ssr: true,
          write: false,
        },
        customLogger: loggerFor(messages),
        logLevel: "silent",
        root,
      },
      options
    )
  );
  const code = [output]
    .flat()
    .flatMap((result) => ("output" in result ? result.output : []))
    .map((chunk) => ("code" in chunk ? chunk.code : ""))
    .join("\n");

  return { code, messages: messages.join("\n") };
}

function upper(): Plugin {
  return {
    name: "upper",
    transform(code, id) {
      if (!id.endsWith(".mdx")) {
        return undefined;
      }

      globalThis.cachedRuns = runs() + 1;

      return `export default ${JSON.stringify(code.toUpperCase())};\n`;
    },
  };
}

describe("cached()", () => {
  it("reuses each file's result in the next build, with the same output", async () => {
    const { root } = await createApp();

    const first = await buildApp(root);
    expect(runs()).toBe(2);
    expect(first.code).toContain('"# A\\n!"');

    const second = await buildApp(root);
    expect(runs()).toBe(2);
    expect(second.code).toBe(first.code);
  });

  it("compiles again only the file whose text changed", async () => {
    const project = await createApp();

    await buildApp(project.root);
    await project.write({ "content/b.mdx": "# b, edited\n" });
    const { code } = await buildApp(project.root);

    expect(runs()).toBe(3);
    expect(code).toContain('"# B, EDITED\\n!"');
  });

  it("compiles every file again after a file the config imports changes", async () => {
    const project = await createApp();

    await buildApp(project.root);
    await project.write({ "options.ts": 'export const suffix = "?";\n' });
    const { code } = await buildApp(project.root);

    expect(runs()).toBe(4);
    expect(code).toContain('"# A\\n?"');
  });

  it("keeps results apart per mode, and compiles again when an option passed to Vite changes", async () => {
    const { root } = await createApp();

    await buildApp(root);
    await buildApp(root, { mode: "staging" });
    expect(runs()).toBe(4);

    await buildApp(root);
    await buildApp(root, { mode: "staging" });
    expect(runs()).toBe(4);

    await buildApp(root, { build: { sourcemap: true } });
    expect(runs()).toBe(6);
  });

  it("drops a deleted file's result, so restoring it compiles it again", async () => {
    const project = await createApp();
    const main = 'import a from "../content/a.mdx";\nexport default [a];\n';

    await buildApp(project.root);
    await rm(path.join(project.root, "content/b.mdx"));
    await project.write({ "src/main.js": main });
    await buildApp(project.root);
    expect(runs()).toBe(2);

    await project.write({
      "content/b.mdx": "# b\n",
      "src/main.js":
        'import a from "../content/a.mdx";\nimport b from "../content/b.mdx";\nexport default [a, b];\n',
    });
    await buildApp(project.root);

    expect(runs()).toBe(3);
  });

  it("keeps results apart per mode when one plugin object is passed to several builds", async () => {
    const { root } = await createApp({
      "vite.config.ts": "export default {};\n",
    });
    const plugin = cached(upper());

    await buildApp(root, { plugins: [plugin] });
    await buildApp(root, { mode: "staging", plugins: [plugin] });

    expect(runs()).toBe(4);
  });

  it("caches nothing without a config file, and says so", async () => {
    const { root } = await createApp();
    const options: InlineConfig = {
      configFile: false,
      plugins: [cached(upper())],
    };

    const { messages } = await buildApp(root, options);
    await buildApp(root, options);

    expect(runs()).toBe(4);
    expect(messages).toContain(
      "[tomekit] cached(upper): Vite runs without a config file"
    );
    await expect(
      access(path.join(root, ".tomekit/cache/plugins"))
    ).rejects.toThrow("ENOENT");
  });

  it("compiles every time a file whose transform uses its context or returns other fields, and names them", async () => {
    const { root } = await createApp({
      "src/main.js":
        'import a from "../content/a.mdx";\nimport meta from "../content/meta.mdx";\nimport watched from "../content/watched.mdx";\nexport default [a, meta, watched];\n',
      "content/meta.mdx": "# meta\n",
      "content/watched.mdx": "# watched\n",
    });

    const { messages } = await buildApp(root);
    await buildApp(root);

    expect(runs()).toBe(5);
    expect(messages).toContain(
      "the transform of content/watched.mdx used this.addWatchFile"
    );
    expect(messages).toContain(
      'the transform of content/meta.mdx returned "meta"'
    );
  });

  it("fails at startup when two cached plugins share a name", async () => {
    const { root } = await createApp();

    await expect(
      buildApp(root, {
        configFile: false,
        plugins: [cached(upper()), cached(upper())],
      })
    ).rejects.toThrow(DuplicateCachedPluginError);
  });

  it("throws for a plugin without a transform hook", () => {
    expect(() => cached({ name: "paths" })).toThrow(UncacheablePluginError);
  });

  it("returns a cached plugin as it is when wrapped again", () => {
    const once = cached(upper());

    expect(cached(once)).toBe(once);
  });
});

async function serve(root: string) {
  const server = await createServer({
    customLogger: loggerFor([]),
    root,
    server: { hmr: false, middlewareMode: true },
  });
  onTestFinished(async () => {
    await server.close();
  });

  return server;
}

describe("cached() in dev", () => {
  it("serves stored results to the client and ssr, and compiles an edited file again", async () => {
    const project = await createApp();
    const id = "/content/a.mdx";

    const first = await serve(project.root);
    const compiled = await Promise.all([
      first.environments.client.transformRequest(id),
      first.environments.ssr.transformRequest(id),
    ]);
    expect(runs()).toBe(2);
    // Closing saves what dev compiled.
    await first.close();

    const second = await serve(project.root);
    const served = await Promise.all([
      second.environments.client.transformRequest(id),
      second.environments.ssr.transformRequest(id),
    ]);
    expect(runs()).toBe(2);
    expect(served.map((result) => result?.code)).toStrictEqual(
      compiled.map((result) => result?.code)
    );

    await project.write({ "content/a.mdx": "# a, edited\n" });
    await expect
      .poll(
        async () => {
          const result = await second.environments.client.transformRequest(id);

          return result?.code;
        },
        { timeout: 5000 }
      )
      .toContain("# A, EDITED");
    expect(runs()).toBe(3);
  });
});
