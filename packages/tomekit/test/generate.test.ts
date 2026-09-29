import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { writeTypes } from "../src/generate";
import { createProject } from "./project";

async function project() {
  const created = await createProject({});
  return created.root;
}

function byName(left: string, right: string) {
  return left.localeCompare(right);
}

function many(count: number) {
  return [
    {
      name: "posts",
      slugs: Array.from({ length: count }, (_, index) => `post-${index}`),
    },
  ];
}

describe(writeTypes, () => {
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

    expect(changed).toBeTruthy();
    await expect(readdir(directory)).resolves.toStrictEqual(["content.d.ts"]);
    const types = await readFile(path.join(directory, "content.d.ts"), "utf-8");
    expect(types.split("\n")).toStrictEqual(
      expect.arrayContaining([
        'import type config from "../tomekit.config";',
        'export type CollectionName = "posts" | "notes";',
        '  "posts": "hello" | "guides/setup";',
        '  "notes": never;',
        "export declare const collections: {",
        'export declare const posts: _Collection<DocumentOf<"posts">, SlugOf<"posts">, SlugOf<"posts">>;',
      ])
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
      ...generated.matchAll(/^export (?:type|declare const) (?<name>\w+)/gmu),
    ].map((match) => match.groups?.name ?? "");

    const fallbackNames = (
      /^export \{(?<names>[^}]*)\}/mu.exec(fallback)?.groups?.names ?? ""
    )
      .split(",")
      .map((name) => name.replace(/^\s*type\s+/u, "").trim())
      .filter((name) => name !== "");

    expect(generatedNames.toSorted(byName)).toStrictEqual(
      [...fallbackNames, "posts"].toSorted(byName)
    );
  });

  it("imports a config inside the types folder by a ./ path", async () => {
    const root = await project();

    await writeTypes(root, path.join(root, "tomekit.config.ts"), [
      { name: "posts", slugs: [] },
    ]);

    await expect(
      readFile(path.join(root, "content.d.ts"), "utf-8")
    ).resolves.toContain('import type config from "./tomekit.config";');
  });

  it("replaces the file whole, so a reader never sees half of it", async () => {
    const root = await project();
    const configPath = path.join(root, "tomekit.config.ts");
    const file = path.join(root, "content.d.ts");

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
    expect(reads.every((read) => complete.has(read))).toBeTruthy();
  });

  it("writes nothing when the types are unchanged", async () => {
    const root = await project();
    const directory = path.join(root, ".tomekit");
    const configPath = path.join(root, "tomekit.config.ts");
    const posts = { name: "posts", slugs: ["hello"] };

    await writeTypes(directory, configPath, [posts]);

    await expect(
      writeTypes(directory, configPath, [posts])
    ).resolves.toBeFalsy();
    await expect(
      writeTypes(directory, configPath, [
        { name: "posts", slugs: ["hello", "later"] },
      ])
    ).resolves.toBeTruthy();
  });
});
