import mdx from "@mdx-js/rollup";
import remarkFrontmatter from "remark-frontmatter";
import { cached, tomekit } from "tomekit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cached({ enforce: "pre", ...mdx({ remarkPlugins: [remarkFrontmatter] }) }),
    tomekit(),
  ],
});
