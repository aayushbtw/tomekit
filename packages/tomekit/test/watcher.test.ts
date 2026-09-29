import path from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { FileWatcher, ignored } from "../src/watcher";
import { createProject } from "./project";

let cleanup: (() => Promise<void>) | undefined;

let watcher: FileWatcher | undefined;

afterEach(async () => {
  watcher?.close();
  await cleanup?.();
});

describe("FileWatcher", () => {
  it("reports changes, but none from ignored or dot folders", async () => {
    const project = await createProject({
      "content/.cache/a.md": "",
      "content/drafts/a.md": "",
      "content/posts/a.md": "",
    });

    ({ cleanup } = project);
    const content = path.join(project.root, "content");
    const reported: string[] = [];

    watcher = new FileWatcher((files) => {
      reported.push(...files);
    });

    watcher.watch([
      { ignore: [path.join(content, "drafts/**")], path: content },
    ]);

    await project.write({
      "content/.cache/a.md": "changed",
      "content/drafts/a.md": "changed",
    });
    await project.write({ "content/posts/a.md": "changed" });

    await expect
      .poll(() => reported)
      .toContain(path.join(content, "posts/a.md"));
    expect(reported.filter((file) => !file.includes("posts"))).toStrictEqual(
      []
    );
  });
});

describe("ignored", () => {
  it("skips a whole folder a folder/** pattern leaves out, so Linux never watches it", () => {
    const patterns = [path.join("/root", "node_modules/**")];

    expect(ignored("/root", "node_modules", patterns)).toBe(true);
    expect(ignored("/root", path.join("node_modules", "a.md"), patterns)).toBe(
      true
    );
    expect(ignored("/root", "posts", patterns)).toBe(false);
  });

  it("keeps a folder when a pattern leaves out only some of its files", () => {
    expect(
      ignored("/root", "posts", [path.join("/root", "**/*.draft.md")])
    ).toBe(false);
  });
});
