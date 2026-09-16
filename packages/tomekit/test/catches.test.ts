import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { ContentBuilder } from "../src/builder";
import { createProject, QUERY, SOURCE } from "./project";

// Keeps the problem tags in TSDoc (`@typeError`, `@buildError`, `@warning`, `@notCaught`) true: every tag has a case here, and every case a tag.
const SRC = path.join(import.meta.dirname, "..", "src");

const TAG = /^\s*\*\s*@(buildError|notCaught|typeError|warning)\s+(.+)$/gmu;

const TSC = path.join(import.meta.dirname, "..", "node_modules", ".bin", "tsc");

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    module: "ESNext",
    moduleResolution: "bundler",
    noEmit: true,
    paths: {
      tomekit: [SOURCE],
      "tomekit/content*": ["./.tomekit/content*"],
    },
    skipLibCheck: true,
    strict: true,
    target: "ES2023",
    types: ["node"],
  },
  include: ["*.ts", ".tomekit/**/*.ts"],
});

// Without the extension, which `tsc` rejects in an import path.
const TOMEKIT = JSON.stringify(SOURCE.replace(/\.ts$/u, ""));

const IMPORTS = `import { z } from "zod";
import { defineCollection, defineConfig, directory } from ${TOMEKIT};
`;

const HELLO = "---\ntitle: Hello\n---\n";

type Caught = "Build error" | "Not caught" | "Type error" | "Warning";

interface Case {
  files: Record<string, string>;
  /** The config's file name, when it isn't `tomekit.config.ts`. */
  config?: string;
  /** Part of what reports the problem, so a case can't pass on an unrelated failure. Absent when nothing reports it. */
  message?: string;
}

let cleanup: (() => Promise<void>) | undefined;

afterEach(async () => {
  await cleanup?.();
});

function posts(schema: string, rest = "") {
  return `${IMPORTS}
export default defineConfig({
  collections: {
    posts: { loader: directory("content/posts"), schema: ${schema}${rest} },
  },
});
`;
}

const TITLE = "z.strictObject({ title: z.string() })";

const referencing = `${IMPORTS}
export default defineConfig({
  collections: {
    authors: {
      loader: directory("content/authors"),
      schema: z.strictObject({ draft: z.boolean().default(false) }),
      transform: (_source, { skip }) => skip(),
    },
    people: {
      loader: directory("content/people"),
      schema: z.strictObject({ name: z.string() }),
    },
    posts: {
      loader: directory("content/posts"),
      schema: z.strictObject({ author: z.string() }),
    },
  },
  references: { posts: { author: "people" } },
});
`;

function usage(code: string) {
  return {
    "content/posts/hello.md": HELLO,
    "tomekit.config.ts": posts(TITLE),
    "usage.ts": `import { collections } from "tomekit/content";\n\ndeclare const fromRoute: string;\n\n${code}\n\nexport {};\n`,
  };
}

const cases = {
  "The folder doesn't exist.": {
    message: 'directory "content/posts" does not exist',
    files: { "tomekit.config.ts": posts(TITLE) },
  },
  "The folder has files, but none match `include`.": {
    message: "but it has 1 other file",
    files: {
      "content/posts/hello.mdx": HELLO,
      "tomekit.config.ts": posts(TITLE),
    },
  },
  "The folder has no files.": {
    message: 'directory "content/posts" has no files',
    files: { "content/posts/.gitkeep": "", "tomekit.config.ts": posts(TITLE) },
  },
  "A key names a collection that isn't in the config.": {
    message: "Type '\"authors\"' is not assignable",
    files: {
      "content/posts/hello.md": "---\nauthor: ada\n---\n",
      "tomekit.config.ts": `${IMPORTS}
export default defineConfig({
  collections: {
    posts: { loader: directory("content/posts"), schema: z.strictObject({ author: z.string() }) },
  },
  references: { posts: { author: "authors" } },
});
`,
    },
  },
  "A path doesn't lead to strings, eg a misspelled field.": {
    message: "'autor' does not exist",
    files: {
      "content/posts/hello.md": "---\nauthor: ada\n---\n",
      "tomekit.config.ts": `${IMPORTS}
export default defineConfig({
  collections: {
    authors: { loader: directory("content/posts"), schema: z.strictObject({ author: z.string() }) },
    posts: { loader: directory("content/posts"), schema: z.strictObject({ author: z.string() }) },
  },
  references: { posts: { autor: "authors" } },
});
`,
    },
  },
  "The schema doesn't produce an object.": {
    message: "not assignable to type 'StandardSchema<object>'",
    files: {
      "content/posts/hello.md": HELLO,
      "tomekit.config.ts": posts("z.string()"),
    },
  },
  "A `slug` in frontmatter isn't a non-empty string.": {
    message: "slug: must be a non-empty string",
    files: {
      "content/posts/hello.md": '---\ntitle: Hello\nslug: ""\n---\n',
      "tomekit.config.ts": posts("z.object({ title: z.string() })"),
    },
  },
  "The transform returns a top-level field other than `metadata` or `body`.": {
    message: "Type '{ url: string; }' is not assignable",
    files: {
      "content/posts/hello.md": HELLO,
      "tomekit.config.ts": `${IMPORTS}
const posts = defineCollection({
  loader: directory("content/posts"),
  schema: ${TITLE},
  transform: () => ({ url: "/hello" }),
});

export default defineConfig({ collections: { posts } });
`,
    },
  },
  "The transform returns something that isn't data, eg a function.": {
    message: "cannot write a function at metadata.run",
    files: {
      "content/posts/hello.md": HELLO,
      "tomekit.config.ts": posts(
        TITLE,
        ", transform: ({ metadata }) => ({ metadata: { ...metadata, run: () => 1 } })"
      ),
    },
  },
  "The transform returns a top-level field other than `metadata` or `body`, written inline in `defineConfig`.":
    {
      message: 'transform returned "url"',
      files: {
        "content/posts/hello.md": HELLO,
        "tomekit.config.ts": posts(
          TITLE,
          ', transform: () => ({ url: "/hello" })'
        ),
      },
    },
  "`tsconfig.json` doesn't map `tomekit/content`.": {
    message: "tsconfig.json does not map",
    files: {
      "content/posts/hello.md": HELLO,
      "tomekit.config.ts": posts(TITLE),
      "tsconfig.json": TSCONFIG.replace(
        '"tomekit/content*":["./.tomekit/content*"]',
        '"unmapped*":["./.tomekit/content*"]'
      ),
    },
  },
  'A collection name that isn\'t in the config, eg `collections.get("postz")`.':
    {
      message: "Argument of type '\"postz\"'",
      files: usage('collections.get("postz");'),
    },
  "A collection name isn't letters, digits and `_`, starting with a letter.": {
    message: "has an invalid name",
    files: {
      "content/posts/hello.md": HELLO,
      "tomekit.config.ts": posts(TITLE).replace(
        "    posts: {",
        '    "blog-posts": {'
      ),
    },
  },
  "The collection has no `loader`.": {
    message: "{ loader: Loader<",
    files: {
      "tomekit.config.ts": `${IMPORTS}
export default defineConfig({ collections: { posts: { schema: ${TITLE} } } });
`,
    },
  },
  "The collection has no `loader`, in a JavaScript config.": {
    config: "tomekit.config.js",
    message: "has no loader",
    files: {
      "tomekit.config.js": `import { z } from "zod";
import { defineConfig } from ${TOMEKIT};

export default defineConfig({ collections: { posts: { schema: ${TITLE} } } });
`,
    },
  },
  "The config throws while it loads.": {
    message: "failed to load: typo in config",
    files: { "tomekit.config.ts": 'throw new Error("typo in config");\n' },
  },
  "The config has no default export.": {
    message: "must export a config as its default export",
    files: {
      "tomekit.config.ts": `${posts(TITLE).replace("export default", "export const config =")}`,
    },
  },
  "A field that doesn't exist on `metadata`.": {
    message: "Property 'titel' does not exist",
    files: usage('collections.get("posts").get("hello").metadata.titel;'),
  },
  "The loader returns `issues`.": {
    message: "the API is down",
    files: {
      "tomekit.config.ts": `${IMPORTS}
export default defineConfig({
  collections: {
    pages: {
      loader: { load: () => ({ entries: [], issues: [{ message: "the API is down" }] }) },
      schema: ${TITLE},
    },
  },
});
`,
    },
  },
  "The loader throws.": {
    message: "the loader failed: the API is down",
    files: {
      "tomekit.config.ts": `${IMPORTS}
export default defineConfig({
  collections: {
    pages: {
      loader: {
        load: () => {
          throw new Error("the API is down");
        },
      },
      schema: ${TITLE},
    },
  },
});
`,
    },
  },
  "A misspelled key, with `z.object`, which drops it.": {
    files: {
      "content/posts/hello.md": "---\ntitle: Hello\ntagz: [a]\n---\n",
      "tomekit.config.ts": posts(
        "z.object({ tags: z.array(z.string()).optional(), title: z.string() })"
      ),
    },
  },
  "A misspelled key, with a strict schema like `z.strictObject`.": {
    message: 'Unrecognized key: "tagz"',
    files: {
      "content/posts/hello.md": "---\ntitle: Hello\ntagz: [a]\n---\n",
      "tomekit.config.ts": posts(
        "z.strictObject({ tags: z.array(z.string()).optional(), title: z.string() })"
      ),
    },
  },
  "A referenced slug of a document with errors.": {
    message: "has errors, so it is left out",
    files: {
      "content/authors/.gitkeep": "",
      "content/people/ada.md": "---\nname: 1\n---\n",
      "content/posts/hello.md": "---\nauthor: ada\n---\n",
      "tomekit.config.ts": referencing,
    },
  },
  "A referenced slug of a skipped document.": {
    message: "is skipped",
    files: {
      "content/authors/ada.md": "---\n---\n",
      "content/people/grace.md": "---\nname: Grace\n---\n",
      "content/posts/hello.md": "---\nauthor: ada\n---\n",
      "tomekit.config.ts": referencing.replace(
        'author: "people"',
        'author: "authors"'
      ),
    },
  },
  "A referenced slug that no document has.": {
    message: 'no document in collection "people" has the slug "ada"',
    files: {
      "content/authors/.gitkeep": "",
      "content/people/grace.md": "---\nname: Grace\n---\n",
      "content/posts/hello.md": "---\nauthor: ada\n---\n",
      "tomekit.config.ts": referencing,
    },
  },
  "A plain string that no file has, eg `get(params.slug)`, which returns `undefined`.":
    {
      files: usage(
        'const post = collections.get("posts").get(fromRoute);\npost?.metadata.title;'
      ),
    },
  'A slug literal that no file has, eg `get("helo-world")`.': {
    message: "Argument of type '\"helo-world\"'",
    files: usage('collections.get("posts").get("helo-world");'),
  },
  "Frontmatter YAML doesn't parse.": {
    message: "content/posts/hello.md:2:14:",
    files: {
      "content/posts/hello.md": "---\ntitle: [Hello\n---\n",
      "tomekit.config.ts": posts(TITLE),
    },
  },
  "Metadata fails the schema, eg a missing `title`.": {
    message: "title: Invalid input: expected string, received undefined",
    files: {
      "content/posts/hello.md": "---\n---\n",
      "tomekit.config.ts": posts(TITLE),
    },
  },
  "Frontmatter isn't keys and values, eg a list.": {
    message: "frontmatter must be keys and values",
    files: {
      "content/posts/hello.md": "---\n- title\n---\n",
      "tomekit.config.ts": posts(TITLE),
    },
  },
  "Two entries have the same slug.": {
    message: 'slug "same" is already used by content/posts/a.md',
    files: {
      "content/posts/a.md": "---\ntitle: A\nslug: same\n---\n",
      "content/posts/b.md": "---\ntitle: B\nslug: same\n---\n",
      "tomekit.config.ts": posts("z.object({ title: z.string() })"),
    },
  },
} satisfies Record<string, Case>;

const caughtByTag = new Map<string, Caught>([
  ["buildError", "Build error"],
  ["notCaught", "Not caught"],
  ["typeError", "Type error"],
  ["warning", "Warning"],
]);

/** Every problem tag in the source, by its text, with each outcome it's tagged with. */
async function documented(): Promise<Map<string, Caught[]>> {
  const files = await readdir(SRC, { recursive: true });
  const problems = new Map<string, Caught[]>();

  for (const file of files.filter((name) => name.endsWith(".ts"))) {
    const source = await readFile(path.join(SRC, file), "utf-8");

    for (const [, tag = "", text = ""] of source.matchAll(TAG)) {
      // Tags inside `generate.ts` template strings escape their backticks.
      const key = text.replaceAll("\\`", "`").trim();
      const caught = caughtByTag.get(tag);

      if (caught !== undefined) {
        problems.set(key, [...new Set([...(problems.get(key) ?? []), caught])]);
      }
    }
  }

  return problems;
}

/** The earliest point a project's problem is caught: `tsc`, then the build, then its warnings. */
async function caught({
  config = "tomekit.config.ts",
  files,
}: Case): Promise<{ reported: string; result: Caught }> {
  // `env.ts` keeps `tsc` from failing on a project with no TypeScript files.
  const project = await createProject({
    "env.ts": "export {};\n",
    "tsconfig.json": TSCONFIG,
    ...files,
  });

  ({ cleanup } = project);

  const builder = new ContentBuilder({
    configPath: path.join(project.root, config),
    dev: false,
    root: project.root,
    runtime: QUERY,
    types: path.join(project.root, ".tomekit"),
  });

  let errors: string[] = [];
  let warnings: string[] = [];

  try {
    const build = await builder.load();
    errors = build.errors.map((error) => error.message);
    ({ warnings } = build);
  } catch (error) {
    errors = [error instanceof Error ? error.message : String(error)];
  }

  const tsc = spawnSync(TSC, ["-p", project.root, "--pretty", "false"], {
    encoding: "utf-8",
  });

  if (tsc.status !== 0) {
    return { reported: tsc.stdout, result: "Type error" };
  }

  if (errors.length > 0) {
    return { reported: errors.join("\n"), result: "Build error" };
  }

  if (warnings.length > 0) {
    return { reported: warnings.join("\n"), result: "Warning" };
  }

  return { reported: "", result: "Not caught" };
}

describe("problem tags", () => {
  it("have a case for every tag, and a tag for every case", async () => {
    const tags = [...(await documented()).keys()].toSorted();

    expect(Object.keys(cases).toSorted()).toStrictEqual(tags);
  });

  it.each(Object.entries(cases))(
    "%s",
    async (problem, test: Case) => {
      const { reported, result } = await caught(test);

      expect((await documented()).get(problem)).toStrictEqual([result]);
      expect(reported).toContain(test.message ?? "");
      expect(test.message === undefined).toBe(result === "Not caught");
    },
    30_000
  );
});
