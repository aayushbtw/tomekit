import { allPosts } from "content-collections";

export default allPosts.map((post) => ({
  body: "mdx" in post ? post.mdx : "html" in post ? post.html : post.content,
  title: post.title,
}));
