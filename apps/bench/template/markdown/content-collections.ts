import { defineCollection, defineConfig } from "@content-collections/core";
import { marked } from "marked";
import { z } from "zod";

const posts = defineCollection({
  directory: "content/posts",
  include: "**/*.md",
  name: "posts",
  schema: z.object({
    content: z.string(),
    date: z.string(),
    description: z.string(),
    draft: z.boolean(),
    tags: z.array(z.string()),
    title: z.string(),
  }),
  transform: async (document, { cache }) => ({
    ...document,
    html: await cache(document.content, (content) =>
      marked.parse(content, { async: false })
    ),
  }),
});

export default defineConfig({ content: [posts] });
