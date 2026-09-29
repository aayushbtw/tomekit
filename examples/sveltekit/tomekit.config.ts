import { marked } from "marked";
import { defineConfig, directory } from "tomekit";
import { z } from "zod";

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts"),
      schema: z.strictObject({
        description: z.string(),
        publishedAt: z.coerce.date(),
        title: z.string(),
      }),
      transform: ({ body }) => ({ body: marked.parse(body, { async: false }) }),
    },
  },
});
