import { query } from "@solidjs/router";
import { posts } from "tomekit/content";

// Server functions, so a page gets only what it renders, not every post.
const getPosts = query(async () => {
  "use server";

  return posts
    .documents()
    .toSorted(
      (a, b) =>
        b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime()
    )
    .map(({ metadata, slug }) => ({ slug, title: metadata.title }));
}, "posts");

const getPost = query(async (slug: string) => {
  "use server";

  return posts.get(slug);
}, "post");

export { getPost, getPosts };
