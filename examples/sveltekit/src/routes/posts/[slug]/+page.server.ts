import { error } from "@sveltejs/kit";
import { posts } from "tomekit/content";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const post = posts.get(params.slug);

  if (!post) {
    error(404, "Post not found");
  }

  return { post };
};
