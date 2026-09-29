import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { posts } from "tomekit/content";

// Server functions, so a page gets only what it renders, not every post.
const getPosts = createServerFn({ method: "GET" }).handler(() =>
  posts
    .documents()
    .toSorted(
      (a, b) =>
        b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime()
    )
    .map(({ metadata, slug }) => ({ slug, title: metadata.title }))
);

const getPost = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(({ data: slug }) => {
    const post = posts.get(slug);

    if (!post) {
      throw notFound();
    }

    return post;
  });

export { getPost, getPosts };
