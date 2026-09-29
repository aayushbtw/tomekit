import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { readCache, writeCache } from "../src/cache";
import type { BuiltDocument } from "../src/collection";
import { serialize } from "../src/serialize";
import type { ContentValue } from "../src/value";
import { createProject } from "./project";

function documentOf(output: ContentValue): BuiltDocument {
  return {
    file: undefined,
    locate: undefined,
    module: undefined,
    output,
    serialized: serialize(output),
    setsSlug: false,
    slug: "one",
  };
}

describe("writeCache and readCache", () => {
  it("give back every value a transform can return", async () => {
    const project = await createProject({});
    const file = path.join(project.root, "cache.json");
    // A hole at index 1, which JSON alone would read back as `null`.
    const holes: ContentValue[] = [1];
    holes[2] = 3;

    const output: ContentValue = {
      // Computed, so it is an own key rather than the prototype.
      ["__proto__"]: { nested: [null, true, "text"] },
      date: new Date(5),
      holes,
      infinity: -Infinity,
      map: new Map<ContentValue, ContentValue>([[1, new Set(["a"])]]),
      nan: Number.NaN,
      negativeZero: -0,
      regexp: /a.b/giu,
      undefined,
      url: new URL("https://example.com/a?b=c"),
    };

    const cache = new Map([
      ["one", { document: documentOf(output), hash: "h" }],
    ]);

    await writeCache(file, { cache, collection: "posts", key: "k" });

    const read = await readCache(file, {
      collection: "posts",
      key: "k",
      root: project.root,
    });

    expect(read.get("one")?.document).toStrictEqual(documentOf(output));
  });
});
