import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import type { RouteDefinition } from "@solidjs/router";
import { For } from "solid-js";

import { getPosts } from "~/lib/posts";

export const route = {
  preload: () => getPosts(),
} satisfies RouteDefinition;

export default function Home() {
  const posts = createAsync(() => getPosts());

  return (
    <>
      <Title>Posts</Title>
      <h1>Posts</h1>
      <ul>
        <For each={posts()}>
          {(post) => (
            <li>
              <a href={`/posts/${post.slug}`}>{post.title}</a>
            </li>
          )}
        </For>
      </ul>
    </>
  );
}
