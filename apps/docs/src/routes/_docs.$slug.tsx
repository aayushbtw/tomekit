import { createFileRoute, redirect } from "@tanstack/react-router";

import { DocPage } from "#/components/doc-page";
import { getDoc } from "#/lib/docs";
import { pageHead } from "#/lib/head";
import { homeSlug } from "#/lib/links";

// Not sorted: `loader` must come before `head` and `component`, which infer `loaderData` from it.
export const Route = createFileRoute("/_docs/$slug")({
  beforeLoad: ({ params }) => {
    if (params.slug === homeSlug) {
      throw redirect({ to: "/" });
    }
  },
  loader: ({ params }) => getDoc({ data: params.slug }),
  head: ({ loaderData, match }) =>
    pageHead({
      description: loaderData?.metadata.description,
      pathname: match.pathname,
      title: loaderData?.metadata.title ?? "Docs",
    }),
  component: Doc,
});

function Doc() {
  return <DocPage doc={Route.useLoaderData()} />;
}
