import { posts } from "./.velite/index.js";

export default posts.map(({ body, title }) => ({ body, title }));
