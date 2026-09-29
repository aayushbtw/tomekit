import { createFileRoute } from "@tanstack/react-router";

import { markdownResponse } from "#/lib/markdown-pages";

export const Route = createFileRoute("/$slug/index.md")({
  server: {
    handlers: {
      GET: ({ params }) => markdownResponse(params.slug),
    },
  },
});
