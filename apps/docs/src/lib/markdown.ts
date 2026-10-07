import { homeSlug } from "./links";
import { site } from "./site";

/** A page as Markdown, at its path plus `/index.md`. */
function markdownPath(slug: string) {
  return slug === homeSlug ? "/index.md" : `/${slug}/index.md`;
}

function markdownUrl(slug: string) {
  return new URL(markdownPath(slug), site.url).href;
}

/** A page's source with what only the site can render made plain: page links, install commands and copy blocks. */
function agentMarkdown(body: string) {
  return body
    .replaceAll(
      /\]\(\/(?<path>[^)#\s]*)(?<hash>#[^)]*)?\)/gu,
      (_link, path: string, hash = "") =>
        `](${markdownUrl(path === "" ? homeSlug : path)}${hash})`
    )
    .replaceAll(
      /<!-- ::install packages="(?<packages>[^"]+)" -->/gu,
      "```sh\nnpm install $<packages>\n```"
    )
    .replaceAll(/<!-- ::(?:start|end):copy[^>]*-->\n+/gu, "");
}

/** A 404 an agent can act on: says what's missing and where the page index is. */
function markdownNotFound(pathname: string) {
  const index = new URL("/llms.txt", site.url).href;

  return new Response(
    `# Page not found\n\nThere's no page at \`${pathname}\`. Every page of the tomekit docs is listed at ${index}.\n`,
    {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        Vary: "Accept",
      },
      status: 404,
    }
  );
}

export { agentMarkdown, markdownNotFound, markdownPath, markdownUrl };
