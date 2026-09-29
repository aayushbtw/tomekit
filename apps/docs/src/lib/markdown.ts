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
      /\]\(\/([^)#\s]*)(#[^)]*)?\)/g,
      (_link, path: string, hash = "") =>
        `](${markdownUrl(path === "" ? homeSlug : path)}${hash})`
    )
    .replaceAll(
      /<!-- ::install packages="([^"]+)" -->/g,
      "```sh\nnpm install $1\n```"
    )
    .replaceAll(/<!-- ::(?:start|end):copy[^>]*-->\n+/g, "");
}

export { agentMarkdown, markdownPath, markdownUrl };
