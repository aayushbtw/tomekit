import { marked } from "marked";
import { defineConfig, s } from "velite";

export default defineConfig({
  collections: {
    posts: {
      name: "Post",
      pattern: "posts/**/*.md",
      schema: s.object({
        body: s.raw().transform((raw) => marked.parse(raw, { async: false })),
        date: s.string(),
        description: s.string(),
        draft: s.boolean(),
        tags: s.array(s.string()),
        title: s.string(),
      }),
    },
  },
});
