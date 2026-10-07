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
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["apps/bench/**"],
        // Benchmark runs must not overlap, or they skew each other's timings.
        rules: { "no-await-in-loop": "off" },
      },
      {
        files: ["packages/tomekit/**"],
        // `Record<never, never>` is the type-level "no fields" the collection types build on.
        rules: { "typescript/no-generated-empty-object-type": "off" },
      },
    ],
    rules: {
      // The docs site renders TSDoc, whose `@remarks` isn't a JSDoc tag.
      "jsdoc/check-tag-names": ["error", { definedTags: ["remarks"] }],
      // Methods are checked bivariantly, so a collection with known slugs still fits `Collection<T>`.
      "typescript/method-signature-style": "off",
      // `this: void` tells lint that destructuring a method off a collection is safe.
      "typescript/no-invalid-void-type": [
        "error",
        { allowAsThisParameter: true },
      ],
      // TanStack Router stops a loader by throwing these.
      "typescript/only-throw-error": [
        "error",
        {
          allow: [
            {
              from: "package",
              name: ["NotFoundError", "Redirect"],
              package: "@tanstack/router-core",
            },
          ],
        },
      ],
      // A union switch lists its cases, and `default-case` then wants a `default` too.
      "typescript/switch-exhaustiveness-check": [
        "error",
        { considerDefaultExhaustiveForUnions: true },
      ],
      // Contradicts `consistent-return` in functions that return `T | undefined`.
      "unicorn/no-useless-undefined": "off",
      // Declarations allow overloads, assertion signatures and hoisting, which arrows don't.
      "func-style": ["error", "declaration", { allowArrowFunctions: false }],
      "no-use-before-define": ["error", { functions: false }],
      "react/function-component-definition": [
        "error",
        { namedComponents: "function-declaration" },
      ],
      // Base UI's checkbox is a span with a hidden input, so the label wraps it rather than pointing at it.
      "jsx-a11y/label-has-associated-control": [
        "error",
        { controlComponents: ["Checkbox", "Switch"], depth: 3 },
      ],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
  },
  run: { cache: true },
});
