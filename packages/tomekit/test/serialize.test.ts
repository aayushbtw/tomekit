import { describe, expect, it } from "vite-plus/test";

import { listSource, serialize, sourceOf } from "../src/serialize";
import { assertContentValue } from "../src/value";
import type { ContentValue } from "../src/value";

async function evaluate(code: string): Promise<ContentValue> {
  const module: unknown = await import(
    `data:text/javascript,export default ${encodeURIComponent(code)}`
  );

  if (module === null || module === undefined) {
    throw new Error("the serialized module did not load");
  }

  const exported: unknown = Object.getOwnPropertyDescriptor(
    module,
    "default"
  )?.value;

  assertContentValue(exported);

  return exported;
}

describe("serialize", () => {
  it("round-trips plain data", async () => {
    const value = { list: [1, "two", true, null], nested: { quote: 'a "b"' } };

    expect(await evaluate(sourceOf(serialize(value)))).toStrictEqual(value);
  });

  it("keeps dates and undefined", async () => {
    const value = { at: new Date("2026-03-27T00:00:00Z"), missing: undefined };

    expect(await evaluate(sourceOf(serialize(value)))).toStrictEqual(value);
  });

  it("keeps numbers JSON cannot represent", async () => {
    const value = [Number.NaN, Infinity, -Infinity, -0];

    expect(await evaluate(sourceOf(serialize(value)))).toStrictEqual(value);
  });

  it("keeps maps, sets, URLs and regular expressions", async () => {
    const value = {
      map: new Map<ContentValue, ContentValue>([
        ["a", 1],
        [2, new Set(["b"])],
      ]),
      pattern: /a\/b/giu,
      url: new URL("https://example.com/a?b=c"),
    };

    expect(await evaluate(sourceOf(serialize(value)))).toStrictEqual(value);
  });

  it("keeps holes in sparse arrays", async () => {
    const sparse: ContentValue[] = [1];

    sparse[2] = 3;

    const trailing: ContentValue[] = [1];

    trailing.length = 2;

    expect(await evaluate(sourceOf(serialize(sparse)))).toStrictEqual(sparse);
    expect(await evaluate(sourceOf(serialize(trailing)))).toStrictEqual(
      trailing
    );
  });

  it("keeps a __proto__ key as a key", async () => {
    const value: unknown = JSON.parse('{"__proto__":{"polluted":true}}');

    assertContentValue(value);

    expect(await evaluate(sourceOf(serialize(value)))).toStrictEqual(value);
  });

  it("emits plain JSON data through JSON.parse, which loads faster", async () => {
    const value = {
      list: [1, "two", true, null],
      nested: { quote: "a 'b' \\ \"c\"" },
    };

    const source = sourceOf(serialize(value));

    expect(source).toMatch(/^\/\*#__PURE__\*\/JSON\.parse\('/u);
    expect(await evaluate(source)).toStrictEqual(value);
  });

  it("falls back to a literal when JSON.parse would change the value", () => {
    for (const value of [
      { at: new Date(0) },
      { missing: undefined },
      [-0],
      [Number.NaN],
    ]) {
      expect(serialize(value)).toHaveProperty("source");
    }
  });

  it("emits a list of JSON values as one JSON.parse, and a mixed list item by item", async () => {
    const plain = [{ slug: "a" }, { slug: "b" }];
    const mixed = [{ slug: "a" }, { at: new Date(0) }];
    const plainSource = listSource(plain.map(serialize));
    const mixedSource = listSource(mixed.map(serialize));

    expect(plainSource.match(/JSON\.parse/gu)).toHaveLength(1);
    expect(await evaluate(plainSource)).toStrictEqual(plain);
    expect(await evaluate(mixedSource)).toStrictEqual(mixed);
  });
});
