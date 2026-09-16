import { createFileRoute } from "@tanstack/react-router";

import { DocPage } from "#/components/doc-page";
import { getDoc } from "#/lib/docs";
import { pageHead } from "#/lib/head";
import { homeSlug } from "#/lib/links";

export const Route = createFileRoute("/_docs/")({
  loader: () => getDoc({ data: homeSlug }),
  head: ({ match }) => pageHead({ pathname: match.pathname }),
  component: Home,
});

function Home() {
  return <DocPage doc={Route.useLoaderData()} />;
}
