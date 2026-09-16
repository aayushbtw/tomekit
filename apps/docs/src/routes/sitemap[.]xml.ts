import { createFileRoute } from "@tanstack/react-router";
import { collections } from "tomekit/content";

import { homeSlug } from "#/lib/links";
import { site } from "#/lib/site";

function sitemap() {
  const paths = [
    ...collections
      .get("docs")
      .documents()
      .map((doc) => (doc.slug === homeSlug ? "/" : `/${doc.slug}`)),
    ...collections
      .get("reference")
      .documents()
      .map((page) => `/${page.slug}`),
  ];

  const urls = paths.map(
    (path) => `  <url><loc>${new URL(path, site.url).href}</loc></url>`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(sitemap(), {
          headers: { "Content-Type": "application/xml" },
        }),
    },
  },
});
