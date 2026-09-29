import ultracite from "ultracite/oxfmt";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import vitest from "ultracite/oxlint/vitest";
import { defineConfig } from "vite-plus";

const ignorePatterns = [
  ...(ultracite.ignorePatterns ?? []),
  "**/routeTree.gen.ts",
  // Only valid inside a generated fixture, where each tool's module exists.
  "apps/bench/template/entries/**",
  "apps/bench/template/*/entry-*.ts",
];

export default defineConfig({
  fmt: { ...ultracite, ignorePatterns },
  lint: {
    extends: [core, react, tanstack, vitest, antiSlop],
    // Examples are standalone apps outside the workspace: their dependencies aren't installed here, so type-aware rules can't resolve them.
    ignorePatterns: [...ignorePatterns, "examples/**"],
    options: { typeAware: true, typeCheck: true },
  },
  run: { cache: true },
});
