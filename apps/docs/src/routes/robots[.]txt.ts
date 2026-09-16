import { createFileRoute } from "@tanstack/react-router";

import { site } from "#/lib/site";

const robots = `User-agent: *
Allow: /

Sitemap: ${new URL("/sitemap.xml", site.url).href}
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(robots, { headers: { "Content-Type": "text/plain" } }),
    },
  },
});
