import { Link } from "react-router";
import { posts } from "tomekit/content";

import type { Route } from "./+types/home";

// Runs on the server, so only the titles reach the browser, not every post.
export function loader() {
  return posts
    .documents()
    .toSorted(
      (a, b) =>
        b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime()
    )
    .map(({ metadata, slug }) => ({ slug, title: metadata.title }));
}

export function meta() {
  return [{ title: "Posts" }];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <h1>Posts</h1>
      <ul>
        {loaderData.map(({ slug, title }) => (
          <li key={slug}>
            <Link to={`/posts/${slug}`}>{title}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
