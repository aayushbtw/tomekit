import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { writeTypes } from "../src/generate";
import { createProject } from "./project";

let cleanup: (() => Promise<void>) | undefined;

afterEach(async () => {
  await cleanup?.();
});

async function project() {
  const created = await createProject({});
  ({ cleanup } = created);

  return created.root;
}

describe("writeTypes", () => {
  it("writes one file with every collection's name and slugs", async () => {
    const root = await project();
    const directory = path.join(root, ".tomekit");

    const changed = await writeTypes(
      directory,
      path.join(root, "tomekit.config.ts"),
      [
        { name: "posts", slugs: ["hello", "guides/setup"] },
        { name: "notes", slugs: [] },
      ]
    );

    expect(changed).toBe(true);
    expect(await readdir(directory)).toStrictEqual(["content.d.ts"]);
    const types = await readFile(path.join(directory, "content.d.ts"), "utf-8");
    expect(types).toContain('import type config from "../tomekit.config";');
    expect(types).toContain('export type CollectionName = "posts" | "notes";');
    expect(types).toContain('  "posts": "hello" | "guides/setup";');
    expect(types).toContain('  "notes": never;');
    expect(types).toContain("export declare const collections: {");
    expect(types).toContain(
      'export declare const posts: _Collection<DocumentOf<"posts">, SlugOf<"posts">, SlugOf<"posts">>;'
    );
  });

  it("exports the tomekit/content fallback's names plus one per collection", async () => {
    const root = await project();
    const directory = path.join(root, ".tomekit");

    await writeTypes(directory, path.join(root, "tomekit.config.ts"), [
      { name: "posts", slugs: [] },
    ]);

    const generated = await readFile(
      path.join(directory, "content.d.ts"),
      "utf-8"
    );

    const fallback = await readFile(
      path.join(import.meta.dirname, "..", "src", "content.ts"),
      "utf-8"
    );

    const generatedNames = [
      ...generated.matchAll(/^export (?:type|declare const) (\w+)/gmu),
    ].map(([, name]) => name ?? "");

    const fallbackNames = (
      /^export \{(?<names>[^}]*)\}/mu.exec(fallback)?.groups?.names ?? ""
    )
      .split(",")
      .map((name) => name.replace(/^\s*type\s+/u, "").trim())
      .filter((name) => name !== "");

    function byName(left: string, right: string) {
      return left.localeCompare(right);
    }

    expect(generatedNames.toSorted(byName)).toStrictEqual(
      [...fallbackNames, "posts"].toSorted(byName)
    );
  });

  it("imports a config inside the types folder by a ./ path", async () => {
    const root = await project();

    await writeTypes(root, path.join(root, "tomekit.config.ts"), [
      { name: "posts", slugs: [] },
    ]);

    expect(await readFile(path.join(root, "content.d.ts"), "utf-8")).toContain(
      'import type config from "./tomekit.config";'
    );
  });

  it("replaces the file whole, so a reader never sees half of it", async () => {
    const root = await project();
    const configPath = path.join(root, "tomekit.config.ts");
    const file = path.join(root, "content.d.ts");

    function many(count: number) {
      return [
        {
          name: "posts",
          slugs: Array.from({ length: count }, (_, index) => `post-${index}`),
        },
      ];
    }

    await writeTypes(root, configPath, many(100_000));
    const complete = new Set([await readFile(file, "utf-8")]);
    let writing = true;

    const written = (async () => {
      for (const count of [200_000, 100_000, 200_000]) {
        await writeTypes(root, configPath, many(count));
        complete.add(await readFile(file, "utf-8"));
      }

      writing = false;
    })();

    const reads: string[] = [];

    while (writing) {
      reads.push(await readFile(file, "utf-8"));
    }

    await written;

    expect(reads.length).toBeGreaterThan(0);
    expect(reads.every((read) => complete.has(read))).toBe(true);
  });

  it("writes nothing when the types are unchanged", async () => {
    const root = await project();
    const directory = path.join(root, ".tomekit");
    const configPath = path.join(root, "tomekit.config.ts");
    const posts = { name: "posts", slugs: ["hello"] };

    await writeTypes(directory, configPath, [posts]);

    expect(await writeTypes(directory, configPath, [posts])).toBe(false);
    expect(
      await writeTypes(directory, configPath, [
        { name: "posts", slugs: ["hello", "later"] },
      ])
    ).toBe(true);
  });
});
