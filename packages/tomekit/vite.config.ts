import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    // Shipped as dist/AGENTS.md; kept out of the package root so agents working on tomekit itself don't load it.
    copy: [{ from: "agent-guide.md", rename: "AGENTS.md" }],
    // js-yaml is bundled so tomekit installs with no dependencies; anything else bundled by accident fails the build.
    deps: { onlyBundle: ["js-yaml"], resolveDepSubpath: true },
    dts: true,
    entry: [
      "src/bin.ts",
      "src/content.ts",
      "src/content-modules.ts",
      "src/index.ts",
      "src/register.ts",
      "src/vite.ts",
    ],
    platform: "node",
  },
  test: {
    coverage: { include: ["src/**"] },
  },
});
