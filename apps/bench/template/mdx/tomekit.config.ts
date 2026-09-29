import type { MDXModule } from "mdx/types";
import { defineConfig, directory, fileModule } from "tomekit";
import { z } from "zod";

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts", { files: "**/*.mdx" }),
      schema: z.strictObject({
        date: z.string(),
        description: z.string(),
        draft: z.boolean(),
        tags: z.array(z.string()),
        title: z.string(),
      }),
      transform: ({ file }) => ({ body: fileModule<MDXModule>(file.path) }),
    },
  },
});
