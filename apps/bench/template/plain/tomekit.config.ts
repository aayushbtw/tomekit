import { defineConfig, directory } from "tomekit";
import { z } from "zod";

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts"),
      schema: z.strictObject({
        date: z.string(),
        description: z.string(),
        draft: z.boolean(),
        tags: z.array(z.string()),
        title: z.string(),
      }),
    },
  },
});
