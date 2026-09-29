import { collections } from "tomekit/content";

export default collections
  .get("posts")
  .documents()
  .map(({ body, metadata }) => ({ body, title: metadata.title }));
