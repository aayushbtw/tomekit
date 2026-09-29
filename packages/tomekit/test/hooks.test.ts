import type { ResolveFnOutput } from "node:module";

import { describe, expect, it } from "vite-plus/test";

import { contentHooks } from "../src/hooks";

const STUB = "file:///app/node_modules/tomekit/dist/content.mjs";

const GENERATED = "file:///app/.tomekit/content.js";

// Stands in for Node's own resolver: the bare specifier and the stub's URL both land on the stub.
function nextResolve(specifier: string): ResolveFnOutput {
  if (specifier === "tomekit/content") {
    return { url: STUB };
  }

  return { url: new URL(specifier, "file:///app/").href };
}

function resolve(specifier: string) {
  const { resolve: hook } = contentHooks(new Map([[STUB, GENERATED]]));

  return hook?.(
    specifier,
    { conditions: [], importAttributes: {}, parentURL: undefined },
    nextResolve
  );
}

describe("contentHooks", () => {
  it("sends tomekit/content to the generated module", () => {
    expect(resolve("tomekit/content")).toStrictEqual({
      format: "module",
      shortCircuit: true,
      url: GENERATED,
    });
  });

  it("sends the stub's file URL there too, the way a bundled vite.config.ts imports it", () => {
    expect(resolve(STUB)?.url).toBe(GENERATED);
  });

  it("leaves every other import to Node", () => {
    expect(resolve("src/post.ts")).toStrictEqual({
      url: "file:///app/src/post.ts",
    });
  });
});
