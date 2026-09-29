import { createFileRoute } from "@tanstack/react-router";

import { markdownResponse } from "#/lib/markdown-pages";

export const Route = createFileRoute("/$slug/$kind/$name/index.md")({
  server: {
    handlers: {
      GET: ({ params: { kind, name, slug } }) =>
        markdownResponse(`${slug}/${kind}/${name}`),
    },
  },
});
