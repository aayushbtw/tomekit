import { createFileRoute } from "@tanstack/react-router";

import { getPost } from "#/server/posts";

// `loader` first: the router infers the other options from it in order.
export const Route = createFileRoute("/posts/$slug")({
  loader: ({ params }) => getPost({ data: params.slug }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.metadata.title },
      { content: loaderData?.metadata.description, name: "description" },
    ],
  }),
  component: Post,
});

function Post() {
  const post = Route.useLoaderData();

  return (
    <article>
      <h1>{post.metadata.title}</h1>
      <time dateTime={post.metadata.publishedAt.toISOString()}>
        {post.metadata.publishedAt.toDateString()}
      </time>
      {/* Rendered by marked at build time from your own Markdown files. */}
      <div dangerouslySetInnerHTML={{ __html: post.body }} />
    </article>
  );
}
