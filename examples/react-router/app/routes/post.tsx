import { data } from "react-router";
import { posts } from "tomekit/content";

import type { Route } from "./+types/post";

export function loader({ params }: Route.LoaderArgs) {
  const post = posts.get(params.slug);

  if (!post) {
    throw data(null, { status: 404 });
  }

  return post;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData.metadata.title },
    { content: loaderData.metadata.description, name: "description" },
  ];
}

export default function Post({ loaderData: post }: Route.ComponentProps) {
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
