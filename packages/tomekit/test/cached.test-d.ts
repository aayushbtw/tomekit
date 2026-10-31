// Checked by `vpr check`, never run: each line fails to compile if inference breaks.
import mdx from "@mdx-js/rollup";
import type { Plugin } from "vite";

import { cached } from "../src/vite";

// Typed for Rollup, whose source maps since 4.66 include index maps that Vite's types don't list.
export const mdxPlugin: Plugin = cached({ enforce: "pre", ...mdx() });
