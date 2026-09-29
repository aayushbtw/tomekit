import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { ContentBuilder } from "../src/builder";
import { ConfigLoadError } from "../src/errors";
import { createProject, SOURCE } from "./project";

// Counts `load` runs on `globalThis`, which the config shares with the test
// even though Vite imports it separately.
const config = `
import { z } from "zod";
import { defineCollection, defineConfig, directory } from ${JSON.stringify(SOURCE)};

export default defineConfig({
  collections: {
    data: defineCollection({
      loader: {
        load: ({ watch }) => {
          globalThis.tomekitLoads = (globalThis.tomekitLoads ?? 0) + 1;
          watch("data/*.json");
          return { entries: [{ slug: "one" }] };
        },
      },
      schema: z.object({}),
    }),
    posts: defineCollection({
      loader: directory("content/posts", { files: ["**/*.md", "!drafts/**"] }),
      schema: z.object({ title: z.string() }),
    }),
  },
});
`;

const referencing = `
import { z } from "zod";
import { defineConfig, directory } from ${JSON.stringify(SOURCE)};

export default defineConfig({
  collections: {
    authors: { loader: directory("content/authors"), schema: z.object({}) },
    posts: {
      loader: directory("content/posts"),
      schema: z.object({ author: z.string() }),
    },
  },
  references: { posts: { author: "authors" } },
});
`;

// Waits on `globalThis.tomekitGate`, so a test can change a file while `load` runs.
const gated = `
import { z } from "zod";
import { defineConfig } from ${JSON.stringify(SOURCE)};

export default defineConfig({
  collections: {
    data: {
      loader: {
        load: async ({ watch }) => {
          globalThis.tomekitLoads = (globalThis.tomekitLoads ?? 0) + 1;
          const run = globalThis.tomekitLoads;
          watch("data/*.json");
          await globalThis.tomekitGate;
          return { entries: [{ slug: \`run\${run}\` }] };
        },
      },
      schema: z.object({}),
    },
  },
});
`;

// Fails to import once `globalThis.tomekitGate` resolves.
const failingConfig = `
globalThis.tomekitStarted = true;
await globalThis.tomekitGate;
throw new Error("typo in config");
`;

const countedConfig = `globalThis.tomekitImports = (globalThis.tomekitImports ?? 0) + 1;\n${config}`;

const watching = `
import { z } from "zod";
import { defineConfig } from ${JSON.stringify(SOURCE)};

export default defineConfig({
  collections: {
    file: {
      loader: {
        load: ({ watch }) => {
          watch("data/site.json");
          return { entries: [] };
        },
      },
      schema: z.object({}),
    },
    plain: { loader: { load: () => ({ entries: [] }) }, schema: z.object({}) },
  },
});
`;

// \`directory()\` leaves \`content/api\` out, and the loader around it watches that folder itself.
const composed = `
import { z } from "zod";
import { defineConfig, directory } from ${JSON.stringify(SOURCE)};

const pages = directory("content", { files: ["**/*.md", "!api/**"] });

export default defineConfig({
  collections: {
    docs: {
      loader: {
        load: async (context) => {
          const written = await pages.load(context);
          context.watch("content/api/*.md");
          return written;
        },
      },
      schema: z.object({}),
    },
  },
});
`;

// Watches on its first run and throws before watching on every later one.
const breaking = `
import { z } from "zod";
import { defineConfig } from ${JSON.stringify(SOURCE)};

export default defineConfig({
  collections: {
    data: {
      loader: {
        load: ({ watch }) => {
          globalThis.tomekitLoads = (globalThis.tomekitLoads ?? 0) + 1;
          if (globalThis.tomekitLoads > 1) throw new Error("broken data");
          watch("data/*.json");
          return { entries: [] };
        },
      },
      schema: z.object({}),
    },
  },
});
`;

// Counts transform runs, and returns a Date and `dev`, so a cached result must keep both.
const transforming = `
import { z } from "zod";
import { defineConfig, directory } from ${JSON.stringify(SOURCE)};
import { suffix } from "./suffix.ts";

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts"),
      schema: z.object({ draft: z.boolean().optional(), title: z.string() }),
      transform: ({ metadata }, { dev, skip }) => {
        globalThis.tomekitTransforms = (globalThis.tomekitTransforms ?? 0) + 1;

        return metadata.draft
          ? skip("draft")
          : { metadata: { ...metadata, date: new Date(0), dev, title: metadata.title + suffix } };
      },
    },
  },
});
`;

declare global {
  var tomekitGate: Promise<void> | undefined;
  var tomekitImports: number | undefined;
  var tomekitLoads: number | undefined;
  var tomekitStarted: boolean | undefined;
  var tomekitTransforms: number | undefined;
}

/** Sets `globalThis.tomekitGate` and returns the function that opens it. */
function gate() {
  let open: (() => void) | undefined;

  globalThis.tomekitGate = new Promise<void>((resolve) => {
    open = resolve;
  });

  return () => {
    open?.();
  };
}

const HELLO = "---\ntitle: Hello\n---\n";

let cleanup: (() => Promise<void>) | undefined;

afterEach(async () => {
  globalThis.tomekitGate = undefined;
  globalThis.tomekitImports = 0;
  globalThis.tomekitLoads = 0;
  globalThis.tomekitStarted = false;
  globalThis.tomekitTransforms = 0;
  await cleanup?.();
});

async function createBuilder(files: Record<string, string>) {
  const project = await createProject({
    "tomekit.config.ts": config,
    ...files,
  });

  ({ cleanup } = project);

  const builder = new ContentBuilder({
    configPath: path.join(project.root, "tomekit.config.ts"),
    dev: false,
    rebuilds: true,
    root: project.root,
  });

  function changed(file: string) {
    return builder.changed(path.join(project.root, file));
  }

  return { builder, changed, project };
}

describe("ContentBuilder", () => {
  it("shares one build between callers until something changes", async () => {
    const { builder, changed, project } = await createBuilder({
      "content/posts/hello.md": HELLO,
    });

    const [first, second] = await Promise.all([builder.load(), builder.load()]);
    expect(first).toBe(second);

    await project.write({
      "content/posts/later.md": "---\ntitle: Later\n---\n",
    });
    changed("content/posts/later.md");
    const next = await builder.load();

    expect(next).not.toBe(first);
    expect(next.code).toContain('"later"');
  });

  it("retries a config that failed to load on the next call", async () => {
    const { builder, project } = await createBuilder({
      "content/posts/hello.md": HELLO,
      "tomekit.config.ts": 'throw new Error("typo in config");\n',
    });

    await expect(builder.load()).rejects.toThrow(ConfigLoadError);

    await project.write({ "tomekit.config.ts": config });
    const build = await builder.load();

    expect(build.code).toContain(
      "export const posts = /*#__PURE__*/_createCollection("
    );
  });

  it("keeps broken files out of the module and in the errors", async () => {
    const { builder } = await createBuilder({
      "content/posts/broken.md": "---\ntitle: 1\n---\n",
      "content/posts/hello.md": HELLO,
    });

    const build = await builder.load();

    expect(build.code).toContain('"hello"');
    expect(build.code).not.toContain('"broken"');
    expect(build.errors.map((error) => error.file)).toStrictEqual([
      "content/posts/broken.md",
    ]);
  });

  it("tells changes that matter from the rest", async () => {
    const { builder, changed } = await createBuilder({
      "content/posts/hello.md": HELLO,
    });

    await builder.load();

    expect(changed("content/posts/notes.txt")).toBe(false);
    expect(changed("content/pages/about.md")).toBe(false);
    expect(changed("content/posts/drafts/wip.md")).toBe(false);
    expect(changed("content/posts/new.md")).toBe(true);
    expect(changed("data/pages.json")).toBe(true);
    expect(changed("tomekit.config.ts")).toBe(true);
  });

  it("reruns a loader only when a file it watches or the config changes", async () => {
    const { builder, changed } = await createBuilder({
      "content/posts/hello.md": HELLO,
    });

    await builder.load();
    changed("content/posts/new.md");
    await builder.load();
    expect(globalThis.tomekitLoads).toBe(1);

    changed("data/pages.json");
    await builder.load();
    expect(globalThis.tomekitLoads).toBe(2);

    changed("tomekit.config.ts");
    await builder.load();
    expect(globalThis.tomekitLoads).toBe(3);
  });

  it("watches the config and where each loader's globs start", async () => {
    const { builder, project } = await createBuilder({
      "content/posts/hello.md": HELLO,
    });

    await builder.load();

    expect(builder.watchFiles).toEqual(
      expect.arrayContaining([
        path.join(project.root, "tomekit.config.ts"),
        path.join(project.root, "content/posts"),
        path.join(project.root, "data"),
      ])
    );
  });

  it("lets a watcher skip only what every collection watching a folder leaves out", async () => {
    const { builder, project } = await createBuilder({
      "content/posts/hello.md": HELLO,
      "tomekit.config.ts": `
import { z } from "zod";
import { defineConfig, directory } from ${JSON.stringify(SOURCE)};

export default defineConfig({
  collections: {
    drafts: { loader: directory("content", { files: ["**/*.md", "!api/**"] }), schema: z.object({}) },
    posts: { loader: directory("content", { files: ["**/*.md", "!api/**", "!drafts/**"] }), schema: z.object({}) },
  },
});
`,
    });

    await builder.load();

    expect(builder.watchTargets).toContainEqual({
      ignore: [path.join(project.root, "content/api/**")],
      path: path.join(project.root, "content"),
    });
  });

  it("leaves out a document whose reference breaks, until the other collection has the slug", async () => {
    const { builder, changed, project } = await createBuilder({
      "content/authors/ada.md": "Ada\n",
      "content/posts/hello.md": "---\nauthor: ada\n---\n",
      "content/posts/typo.md": "---\nauthor: adaa\n---\n",
      "tomekit.config.ts": referencing,
    });

    const broken = await builder.load();
    const types = path.join(project.root, ".tomekit", "content.d.ts");

    expect(broken.code).toContain('"hello"');
    expect(broken.code).not.toContain('"typo"');
    expect(broken.errors.map((error) => error.message)).toStrictEqual([
      'content/posts/typo.md:2:1: author: no document in collection "authors" has the slug "adaa". Fix the slug, or add a document with it to "authors"',
    ]);
    expect(await readFile(types, "utf-8")).toContain('  "posts": "hello";');

    await project.write({ "content/authors/adaa.md": "Adaa\n" });
    changed("content/authors/adaa.md");
    const fixed = await builder.load();

    expect(fixed.errors).toStrictEqual([]);
    expect(fixed.code).toContain('"typo"');
    expect(await readFile(types, "utf-8")).toContain(
      '  "posts": "hello" | "typo";'
    );
  });

  it("watches a plain file pattern, and nothing for a loader without watch", async () => {
    const { builder, changed, project } = await createBuilder({
      "tomekit.config.ts": watching,
    });

    await builder.load();

    expect(builder.watchFiles).toContain(
      path.join(project.root, "data/site.json")
    );
    expect(changed("data/site.json")).toBe(true);
    expect(changed("data/other.json")).toBe(false);
  });

  it("leaves files out only for the watch call that excluded them", async () => {
    const { builder, changed } = await createBuilder({
      "content/guide.md": HELLO,
      "tomekit.config.ts": composed,
    });

    await builder.load();

    expect(changed("content/api/types.md")).toBe(true);
    expect(changed("content/guide.md")).toBe(true);
    expect(changed("content/api/types.txt")).toBe(false);
  });

  it("keeps watching after a load throws before it calls watch", async () => {
    const { builder, changed } = await createBuilder({
      "tomekit.config.ts": breaking,
    });

    await builder.load();
    changed("data/pages.json");
    const broken = await builder.load();

    expect(broken.errors.map((error) => error.message)).toStrictEqual([
      "data: the loader failed: broken data",
    ]);
    expect(changed("data/pages.json")).toBe(true);
  });

  it("drops a result from a build that a change made stale", async () => {
    const release = gate();

    const { builder, changed } = await createBuilder({
      "tomekit.config.ts": gated,
    });

    const stale = builder.load();

    await vi.waitFor(
      () => {
        expect(globalThis.tomekitLoads).toBe(1);
      },
      { timeout: 5000 }
    );
    changed("data/pages.json");
    release();

    expect((await stale).code).toContain('"run1"');
    expect((await builder.load()).code).toContain('"run2"');
  });

  it("keeps the config and build that replaced one still failing to import", async () => {
    const release = gate();

    const { builder, changed, project } = await createBuilder({
      "content/posts/hello.md": HELLO,
      "tomekit.config.ts": failingConfig,
    });

    const failing = builder.load();

    await vi.waitFor(
      () => {
        expect(globalThis.tomekitStarted).toBe(true);
      },
      { timeout: 5000 }
    );
    await project.write({ "tomekit.config.ts": countedConfig });
    changed("tomekit.config.ts");
    const replacing = await builder.load();
    release();

    await expect(failing).rejects.toThrow(ConfigLoadError);
    expect(await builder.load()).toBe(replacing);

    changed("content/posts/new.md");
    await builder.load();
    expect(globalThis.tomekitImports).toBe(1);
  });

  it("writes a module to .tomekit that imports nothing and serves the same documents", async () => {
    const { builder, project } = await createBuilder({
      "content/posts/hello.md": HELLO,
    });

    const build = await builder.load();
    const file = path.join(project.root, ".tomekit", "content.js");
    const code = await readFile(file, "utf-8");

    expect(code).toBe(build.code);
    expect(code).not.toMatch(/\bimport\b/u);

    // Evaluated by Node, not Vite, as a script outside the plugin would.
    const content: unknown = await import(
      /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(code)}`
    );

    expect(content).toHaveProperty("posts");
    expect(content).toHaveProperty("collections");
  });

  it("warns about an unmapped tsconfig only on the first build", async () => {
    const { builder, changed } = await createBuilder({
      "content/posts/hello.md": HELLO,
      "tsconfig.json": '{ "compilerOptions": { "strict": true } }',
    });

    const first = await builder.load();
    changed("content/posts/hello.md");
    const second = await builder.load();

    expect(first.warnings).toStrictEqual([
      expect.stringContaining('tsconfig.json does not map "tomekit/content"'),
    ]);
    expect(second.warnings).toStrictEqual([]);
  });
});

describe("the cache in .tomekit", () => {
  async function createCachedProject(files: Record<string, string> = {}) {
    const project = await createProject({
      "content/posts/draft.md": "---\ntitle: Draft\ndraft: true\n---\n",
      "content/posts/hello.md": HELLO,
      // Its own, so editing it can't touch the repo's.
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      "suffix.ts": 'export const suffix = "!";\n',
      "tomekit.config.ts": transforming,
      ...files,
    });

    ({ cleanup } = project);

    return project;
  }

  /** A build by a new builder, as a new process runs it, and how many transforms it ran. */
  async function build(root: string, { dev = false } = {}) {
    globalThis.tomekitTransforms = 0;

    const builder = new ContentBuilder({
      configPath: path.join(root, "tomekit.config.ts"),
      dev,
      rebuilds: false,
      root,
    });

    const { code, errors } = await builder.load();

    return { code, errors, transforms: globalThis.tomekitTransforms };
  }

  it("reruns no transform in a new process, and only an edited entry's", async () => {
    const { root, write } = await createCachedProject();

    const cold = await build(root);
    const warm = await build(root);

    expect(cold.transforms).toBe(2);
    expect(warm).toStrictEqual({ ...cold, transforms: 0 });

    await write({ "content/posts/hello.md": "---\ntitle: Hi\n---\n" });
    const edited = await build(root);

    expect(edited.transforms).toBe(1);
    expect(edited.code).toContain('"Hi!"');
  });

  it.each(["tomekit.config.ts", "suffix.ts", "pnpm-lock.yaml"])(
    "reruns every transform after %s changes",
    async (file) => {
      const { root, write } = await createCachedProject();
      await build(root);

      const source = await readFile(path.join(root, file), "utf-8");
      await write({ [file]: `${source}\n` });

      expect((await build(root)).transforms).toBe(2);
    }
  );

  it("keeps dev results apart from build results", async () => {
    const { root } = await createCachedProject();

    await build(root, { dev: true });

    expect((await build(root)).transforms).toBe(2);
    expect((await build(root, { dev: true })).transforms).toBe(0);
  });

  it("builds as if there were no cache when its file is broken", async () => {
    const { root, write } = await createCachedProject();
    const cold = await build(root);

    await write({ ".tomekit/cache/build/posts.json": "{ not json" });

    expect(await build(root)).toStrictEqual({ ...cold, transforms: 2 });
  });

  it("reruns a transform whose module file is gone", async () => {
    const { root } = await createCachedProject({
      "components/intro.js": "export default 1;\n",
      "tomekit.config.ts": `
import { z } from "zod";
import { defineConfig, directory, fileModule } from ${JSON.stringify(SOURCE)};

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts"),
      schema: z.object({ title: z.string() }),
      transform: () => ({ body: fileModule("components/intro.js") }),
    },
  },
});
`,
    });

    await build(root);
    await rm(path.join(root, "components/intro.js"));

    expect((await build(root)).errors.map((error) => error.message)).toContain(
      'content/posts/hello.md: fileModule("components/intro.js") points at a file that does not exist. Pass a path relative to the project root, eg `file.path`.'
    );
  });
});
