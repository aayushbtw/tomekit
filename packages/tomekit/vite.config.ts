import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    // js-yaml is bundled so tomekit installs with no dependencies; anything else bundled by accident fails the build.
    deps: { onlyBundle: ["js-yaml"], resolveDepSubpath: true },
    dts: true,
    entry: ["src/index.ts", "src/content.ts", "src/register.ts", "src/vite.ts"],
    platform: "node",
  },
  test: {
    coverage: { include: ["src/**"] },
  },
});
