import { describe, expect, it } from "vite-plus/test";

import { createImportModule } from "../src/import-module";

describe(createImportModule, () => {
  it("imports each module once, however often it is asked for", async () => {
    let imports = 0;

    const importModule = createImportModule(
      new Map([
        [
          "content/a.mdx",
          async () => {
            imports += 1;

            return await Promise.resolve({ default: "A" });
          },
        ],
      ])
    );

    const first = importModule("content/a.mdx");

    expect(importModule("content/a.mdx")).toBe(first);
    await expect(first).resolves.toStrictEqual({ default: "A" });
    expect(imports).toBe(1);
  });

  it("marks a module as fulfilled once imported, so React's use() reads it without suspending", async () => {
    const importModule = createImportModule(
      new Map([["content/a.mdx", async () => await Promise.resolve({})]])
    );

    const promise = importModule("content/a.mdx");
    await promise;
    await Promise.resolve();

    expect(promise).toMatchObject({ status: "fulfilled", value: {} });
  });

  it("rejects a path that is not a module, naming it", async () => {
    const importModule = createImportModule(new Map());

    await expect(importModule("content/missing.mdx")).rejects.toThrow(
      'no module at "content/missing.mdx"'
    );
  });
});
