import { describe, expect, it } from "vite-plus/test";

import { createCollection, createCollections } from "../src/query";

const collection = createCollection([
  { slug: "b", title: "Beta" },
  { slug: "a", title: "Alpha" },
]);

describe(createCollection, () => {
  it("keeps documents and slugs in the order given", () => {
    expect(collection.documents().map((post) => post.title)).toStrictEqual([
      "Beta",
      "Alpha",
    ]);
    expect(collection.slugs()).toStrictEqual(["b", "a"]);
  });

  it("finds and checks a document by slug", () => {
    expect(collection.get("a")?.title).toBe("Alpha");
    expect(collection.get("missing")).toBeUndefined();
    expect(collection.has("a")).toBeTruthy();
    expect(collection.has("missing")).toBeFalsy();
  });

  it("works when its members are destructured", () => {
    const { documents, get, has, slugs } = collection;
    expect(get("b")?.title).toBe("Beta");
    expect(has("b")).toBeTruthy();
    expect([documents().length, slugs().length]).toStrictEqual([2, 2]);
  });
});

describe(createCollections, () => {
  const collections = createCollections({
    notes: createCollection([
      { slug: "a", title: "A" },
      { slug: "b", title: "B" },
    ]),
    posts: createCollection([{ slug: "hello", title: "Hello" }]),
  });

  it("lists collection names in config order", () => {
    expect(collections.names()).toStrictEqual(["notes", "posts"]);
  });

  it("finds and checks a collection by name, and nothing for other strings", () => {
    expect(collections.get("posts")?.get("hello")?.title).toBe("Hello");
    expect(collections.has("posts")).toBeTruthy();
    expect(collections.get("drafts")).toBeUndefined();
    expect(collections.get("toString")).toBeUndefined();
    expect(collections.has("toString")).toBeFalsy();
  });
});
