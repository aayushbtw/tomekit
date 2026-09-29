import { allPosts } from "content-collections";

export default allPosts.map((post) => ({
  body: "html" in post ? post.html : post.content,
  title: post.title,
}));
