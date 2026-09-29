import { defineConfig } from "vite-plus";

const ignorePatterns = [
  "**/coverage",
  "**/dist",
  "**/node_modules",
  "**/pnpm-lock.yaml",
  "**/routeTree.gen.ts",
  // Only valid inside a generated fixture, where each tool's module exists.
  "apps/bench/template/entries/**",
  "apps/bench/template/*/entry-*.ts",
  ".agent/**",
  ".agents/**",
  ".claude/**",
  ".codex/**",
  ".continue/**",
  ".cursor/**",
  ".gemini/**",
  ".opencode/**",
  ".pi/**",
  ".roo/**",
  ".windsurf/**",
];

export default defineConfig({
  fmt: { ignorePatterns },
  lint: {
    // Examples are standalone apps outside the workspace: their dependencies aren't installed here, so type-aware rules can't resolve them.
    ignorePatterns: [...ignorePatterns, "examples/**"],
    options: { typeAware: true, typeCheck: true },
  },
  run: { cache: true },
});
