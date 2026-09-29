import { posts } from "tomekit/content";

export default posts
  .documents()
  .map(({ body, metadata }) => ({ body, title: metadata.title }));
