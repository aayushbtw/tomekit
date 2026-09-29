import { createFileRoute } from "@tanstack/react-router";

import { homeSlug } from "#/lib/links";
import { markdownResponse } from "#/lib/markdown-pages";

export const Route = createFileRoute("/index.md")({
  server: {
    handlers: {
      GET: () => markdownResponse(homeSlug),
    },
  },
});
