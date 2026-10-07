import { describe, expect, it } from "vite-plus/test";

import { pageHead } from "#/lib/head";

function structuredData(head: ReturnType<typeof pageHead>) {
  return head.meta.flatMap((tag) =>
    "script:ld+json" in tag ? [tag["script:ld+json"]] : []
  );
}

describe(pageHead, () => {
  it("describes tomekit as schema.org source code on the home page", () => {
    expect(structuredData(pageHead({ pathname: "/" }))).toStrictEqual([
      expect.objectContaining({
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        codeRepository: "https://github.com/aayushbtw/tomekit",
        name: "tomekit",
        url: "https://tomekit.aayush.cv",
      }),
    ]);
  });

  it("leaves structured data off doc pages", () => {
    expect(
      structuredData(pageHead({ pathname: "/reading", title: "Reading" }))
    ).toStrictEqual([]);
  });
});
