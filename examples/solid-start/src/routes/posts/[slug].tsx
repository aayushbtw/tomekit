import { Meta, Title } from "@solidjs/meta";
import { createAsync, useParams } from "@solidjs/router";
import type { RouteDefinition } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { Show } from "solid-js";

import { getPost } from "~/lib/posts";

export const route = {
  preload: ({ params }) =>
    params.slug === undefined ? undefined : getPost(params.slug),
} satisfies RouteDefinition;

export default function Post() {
  const params = useParams<{ slug: string }>();
  const post = createAsync(() => getPost(params.slug));

  return (
    <Show
      fallback={
        <>
          <HttpStatusCode code={404} />
          <h1>Post not found</h1>
        </>
      }
      when={post()}
    >
      {(post) => (
        <article>
          <Title>{post().metadata.title}</Title>
          <Meta content={post().metadata.description} name="description" />
          <h1>{post().metadata.title}</h1>
          <time datetime={post().metadata.publishedAt.toISOString()}>
            {post().metadata.publishedAt.toDateString()}
          </time>
          {/* Rendered by marked at build time from your own Markdown files. */}
          <div innerHTML={post().body} />
        </article>
      )}
    </Show>
  );
}
