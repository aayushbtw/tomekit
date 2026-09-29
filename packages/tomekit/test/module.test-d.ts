// Checked by `vpr check`, never run: each line fails to compile if inference breaks.
import { z } from "zod";

import { importModule } from "../src/content-modules";
import { defineCollection, directory, fileModule } from "../src/index";
import type { Collection, InferDocument, Module } from "../src/index";

interface PostModule {
  default: () => string;
  readingTime: number;
}

declare function read<TCollection>(
  collection: TCollection
): Collection<InferDocument<TCollection>>;

const posts = read(
  defineCollection({
    loader: directory("content/posts", { files: "**/*.mdx" }),
    schema: z.object({ title: z.string() }),
    transform: ({ file }) => ({ body: fileModule<PostModule>(file.path) }),
  })
);

const post = posts.get("hello");

// A module body is its path at runtime, so it crosses a server function as a string.
export const body: Module<PostModule> | undefined = post?.body;

export const path: string | undefined = post?.body;

export async function readingTime(module: Module<PostModule>) {
  const exports: PostModule = await importModule(module);

  return exports.readingTime;
}

export async function plainString() {
  // @ts-expect-error a plain string is not a module
  return await importModule("content/posts/hello.mdx");
}
