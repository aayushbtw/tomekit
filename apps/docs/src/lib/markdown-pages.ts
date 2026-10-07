import { markdown } from "tomekit/content";

import { markdownNotFound, markdownPath, markdownUrl } from "#/lib/markdown";
import { sections } from "#/lib/sections";
import { site } from "#/lib/site";
import { sortedDocs } from "#/lib/sorted-docs";

function markdownResponse(slug: string) {
  const page = markdown.get(slug);

  return page
    ? new Response(page.body, {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      })
    : markdownNotFound(markdownPath(slug));
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
    "Every page is Markdown at its URL plus `/index.md`, or at its URL when requested with `Accept: text/markdown`. In a project that installed tomekit, `node_modules/tomekit/dist/AGENTS.md` is the guide for that version.",
    ...groups,
  ].join("\n\n");
}

export { llmsTxt, markdownResponse };
