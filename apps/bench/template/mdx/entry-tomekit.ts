import { posts } from "tomekit/content";

// Referenced, so the build compiles every body into its own chunk, as an app's would.
export { importModule } from "tomekit/content-modules";

export default posts
  .documents()
  .map(({ body, metadata }) => ({ body, title: metadata.title }));
