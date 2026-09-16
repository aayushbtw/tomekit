import { site } from "#/lib/site";

interface PageHeadOptions {
  description?: string | undefined;
  pathname: string;
  title?: string | undefined;
}

/** Tags a page overrides from the root's defaults. Child meta wins over the root's by `name` or `property`. */
function pageHead({
  description = site.description,
  pathname,
  title,
}: PageHeadOptions) {
  const fullTitle = title === undefined ? site.name : `${title} | ${site.name}`;
  const url = new URL(pathname, site.url).href;

  return {
    links: [{ href: url, rel: "canonical" }],
    meta: [
      { title: fullTitle },
      { content: description, name: "description" },
      { content: fullTitle, property: "og:title" },
      { content: description, property: "og:description" },
      { content: url, property: "og:url" },
      { content: fullTitle, name: "twitter:title" },
      { content: description, name: "twitter:description" },
    ],
  };
}

export { pageHead };
