import { createFileRoute } from "@tanstack/react-router";

import { Article } from "#/components/article";
import { getReference } from "#/lib/docs";
import { pageHead } from "#/lib/head";

// Not sorted: `loader` must come before `head` and `component`, which infer `loaderData` from it.
export const Route = createFileRoute("/_docs/$slug_/$kind/$name")({
  loader: async ({ params }) => await getReference({ data: params }),
  head: ({ loaderData, match }) =>
    pageHead({
      description: loaderData?.metadata.description,
      pathname: match.pathname,
      title: loaderData?.metadata.name ?? "Reference",
    }),
  component: Reference,
});

function Reference() {
  const { body, metadata, slug } = Route.useLoaderData();
  const call = metadata.kind === "Function" ? "()" : "";

  return (
    <Article
      body={body}
      description={undefined}
      headings={metadata.headings}
      slug={slug}
      title={`${metadata.kind}: ${metadata.name}${call}`}
    />
  );
}
