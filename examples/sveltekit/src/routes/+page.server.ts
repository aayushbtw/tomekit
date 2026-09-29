import { posts } from "tomekit/content";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({
  posts: posts
    .documents()
    .toSorted(
      (a, b) =>
        b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime()
    )
    .map(({ metadata, slug }) => ({ slug, title: metadata.title })),
});
