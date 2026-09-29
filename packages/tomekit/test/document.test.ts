import { describe, expect, it } from "vite-plus/test";

import { assertTransformResult, buildDocument } from "../src/document";
import {
  MisplacedModuleError,
  TransformMetadataError,
  TransformResultError,
  UnknownTransformFieldError,
  UnserializableValueError,
} from "../src/errors";
import type { Source } from "../src/index";
import { fileModule } from "../src/module";

const source: Source<object> = {
  body: "Text",
  file: { path: "content/a.md" },
  metadata: { title: "A" },
  slug: "a",
};

describe("assertTransformResult", () => {
  it("accepts an object with metadata, body, both or neither", () => {
    for (const result of [
      {},
      { body: "B" },
      { metadata: {} },
      { body: 1, metadata: { order: 1 } },
    ]) {
      expect(() => {
        assertTransformResult(result);
      }).not.toThrow();
    }
  });

  it("rejects anything but a plain object", () => {
    for (const result of [null, undefined, "text", [], new Map()]) {
      expect(() => {
        assertTransformResult(result);
      }).toThrow(TransformResultError);
    }
  });

  it("rejects metadata that isn't a plain object", () => {
    for (const metadata of [null, "text", 1, [], new Map()]) {
      expect(() => {
        assertTransformResult({ metadata });
      }).toThrow(TransformMetadataError);
    }
  });

  it("names the field documents do not have", () => {
    expect(() => {
      assertTransformResult({ metadata: {}, url: "/a" });
    }).toThrow(new UnknownTransformFieldError("url"));
  });
});

describe("buildDocument", () => {
  it("keeps whatever the result leaves out", () => {
    expect(buildDocument(source, {}, "/root")).toStrictEqual({
      document: source,
      module: undefined,
    });
  });

  it("replaces metadata and body when the result has them, even as undefined", () => {
    expect(
      buildDocument(
        source,
        { body: undefined, metadata: { title: "B" } },
        "/root"
      ).document
    ).toStrictEqual({
      body: undefined,
      file: source.file,
      metadata: { title: "B" },
      slug: "a",
    });
  });

  it("names the key path of a value that cannot be written", () => {
    expect(() =>
      buildDocument(source, { metadata: { at: Symbol("x") } }, "/root")
    ).toThrow(UnserializableValueError);
    expect(() =>
      buildDocument(source, { metadata: { at: Symbol("x") } }, "/root")
    ).toThrow("cannot write a symbol at metadata.at into content");
  });

  it("writes a module body as its path from the root", () => {
    expect(
      buildDocument(
        source,
        { body: fileModule("/root/content/./a.mdx") },
        "/root"
      )
    ).toStrictEqual({
      document: { ...source, body: "content/a.mdx" },
      module: "content/a.mdx",
    });
  });

  it("rejects a module anywhere but the body", () => {
    expect(() =>
      buildDocument(
        source,
        { metadata: { intro: fileModule("content/a.mdx") } },
        "/root"
      )
    ).toThrow(new MisplacedModuleError("metadata.intro"));
  });
});
