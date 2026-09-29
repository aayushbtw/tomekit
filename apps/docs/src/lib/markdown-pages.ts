import { markdown } from "tomekit/content";

import { markdownUrl } from "#/lib/markdown";
import { sections } from "#/lib/sections";
import { site } from "#/lib/site";
import { sortedDocs } from "#/lib/sorted-docs";

function markdownResponse(slug: string) {
  const page = markdown.get(slug);

  return page
    ? new Response(page.body, {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      })
    : new Response("Not found\n", { status: 404 });
}

/** The index agents start from, as https://llmstxt.org describes. */
function llmsTxt() {
  const ordered = sortedDocs();

  const groups = [undefined, ...sections].flatMap((section) => {
    const links = ordered.flatMap(({ metadata, slug }) =>
      metadata.section === section
        ? [
            `- [${metadata.title}](${markdownUrl(slug)}): ${metadata.description}`,
          ]
        : []
    );

    return links.length > 0
      ? [[`## ${section ?? "Docs"}`, "", ...links].join("\n")]
      : [];
  });

  return [
    `# ${site.name}`,
    `> ${site.description}`,
    "Every page is Markdown at its URL plus `/index.md`. In a project that installed tomekit, `node_modules/tomekit/dist/AGENTS.md` is the guide for that version.",
    ...groups,
  ].join("\n\n");
}

export { llmsTxt, markdownResponse };
