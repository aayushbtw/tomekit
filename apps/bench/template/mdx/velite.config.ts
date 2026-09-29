import { defineConfig, s } from "velite";

export default defineConfig({
  collections: {
    posts: {
      name: "Post",
      pattern: "posts/**/*.mdx",
      schema: s.object({
        body: s.mdx(),
        date: s.string(),
        description: s.string(),
        draft: s.boolean(),
        tags: s.array(s.string()),
        title: s.string(),
      }),
    },
  },
});
