import { createFileRoute, Link } from "@tanstack/react-router";

import { getPosts } from "#/server/posts";

// `loader` first: the router infers the other options from it in order.
export const Route = createFileRoute("/")({
  loader: () => getPosts(),
  head: () => ({ meta: [{ title: "Posts" }] }),
  component: Home,
});

function Home() {
  return (
    <>
      <h1>Posts</h1>
      <ul>
        {Route.useLoaderData().map(({ slug, title }) => (
          <li key={slug}>
            <Link params={{ slug }} to="/posts/$slug">
              {title}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
