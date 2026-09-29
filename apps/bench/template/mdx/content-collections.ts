import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMDX } from "@content-collections/mdx";
import { z } from "zod";

const posts = defineCollection({
  directory: "content/posts",
  include: "**/*.mdx",
  name: "posts",
  schema: z.object({
    content: z.string(),
    date: z.string(),
    description: z.string(),
    draft: z.boolean(),
    tags: z.array(z.string()),
    title: z.string(),
  }),
  transform: async (document, context) => ({
    ...document,
    mdx: await compileMDX(context, document),
  }),
});

export default defineConfig({ content: [posts] });
