import type { ComponentNode } from "@tanstack/markdown";
import { commentComponentsExtension } from "@tanstack/markdown/extensions/comment-components";
import { collectMarkdownHeadings } from "@tanstack/markdown/extensions/headings";
import { parseMarkdown } from "@tanstack/markdown/parser";
import { defineConfig, defineLoader, directory } from "tomekit";
import type { Source } from "tomekit";
import { z } from "zod";

import { apiReference, apiReferenceWatch } from "./src/lib/api-reference";
import { agentMarkdown } from "./src/lib/markdown";
import { sections } from "./src/lib/sections";
import { site } from "./src/lib/site";

// A component with no `tagName` renders as one generic element for every name, so
// the components map cannot tell `install` from anything else. Naming the tag is what
// makes it addressable. A block's code becomes `text`, so a component can copy it
// without rendering it.
function transformComponent(node: ComponentNode): ComponentNode {
  const text = node.children
    .flatMap((child) => (child.type === "code" ? [child.value] : []))
    .join("\n");

  return {
    ...node,
    properties: { ...node.attributes, ...(text && { text }) },
    tagName: `md-${node.name}`,
  };
}

const extensions = [commentComponentsExtension({ transformComponent })];

function withHeadings<TMetadata extends object>({
  body,
  metadata,
}: Source<TMetadata>) {
  const document = parseMarkdown(body, { extensions, headingIds: true });

  const headings = collectMarkdownHeadings(document).flatMap(
    ({ id, level, text }) => (level === 2 ? [{ id, text }] : [])
  );

  return { body: document, metadata: { ...metadata, headings } };
}

const pages = directory("content/docs");

// The written pages, plus an API reference index page per tomekit entry point.
const docsLoader = defineLoader({
  async load(context) {
    const written = await pages.load(context);
    context.watch(apiReferenceWatch);

    return {
      ...written,
      entries: [...written.entries, ...apiReference(context.root).index],
    };
  },
});

// One page per tomekit export, linked from the API reference index pages.
const referenceLoader = defineLoader({
  load: ({ root, watch }) => {
    watch(apiReferenceWatch);

    return { entries: apiReference(root).items };
  },
});

export default defineConfig({
  collections: {
    docs: {
      loader: docsLoader,
      schema: z.strictObject({
        description: z.string(),
        order: z.number(),
        section: z.enum(sections).optional(),
        title: z.string(),
      }),
      transform: withHeadings,
    },
    // Every page of both collections as Markdown for agents, kept apart so pages don't ship it to the browser.
    markdown: {
      loader: {
        async load(context) {
          const [written, items] = await Promise.all([
            docsLoader.load(context),
            referenceLoader.load(context),
          ]);

          return {
            ...written,
            entries: [...written.entries, ...items.entries],
          };
        },
      },
      schema: z.object({
        description: z.string().optional(),
        name: z.string().optional(),
        title: z.string().optional(),
      }),
      transform: ({ body, metadata, slug }) => {
        const title = metadata.title ?? metadata.name ?? slug;
        const description = metadata.description ?? "";

        return {
          body: `# ${title}\n\n${description}\n\n> Every page: ${new URL("/llms.txt", site.url).href}\n\n${agentMarkdown(body).trimStart()}`,
        };
      },
    },
    reference: {
      loader: referenceLoader,
      schema: z.strictObject({
        description: z.string().optional(),
        kind: z.enum([
          "Class",
          "Function",
          "Interface",
          "Type Alias",
          "Variable",
        ]),
        name: z.string(),
      }),
      transform: withHeadings,
    },
  },
});
