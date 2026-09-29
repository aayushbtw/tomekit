import { notFound, rootRouteId } from "@tanstack/react-router";
import type { NotFoundError } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { docs, reference } from "tomekit/content";
import type { DocumentOf } from "tomekit/content";

import { sections } from "#/lib/sections";
import { sortedDocs } from "#/lib/sorted-docs";
import type { Section } from "#/lib/sorted-docs";

/** A reference page's route params: its index page's slug, its kind's folder and its name. */
interface ReferenceParams {
  kind: string;
  name: string;
  slug: string;
}

// The root route, not this one: a 404 replaces the docs layout instead of rendering inside it.
const notFoundHere: NotFoundError = { routeId: rootRouteId };

function pageLink(doc: DocumentOf<"docs"> | undefined) {
  return doc ? { slug: doc.slug, title: doc.metadata.title } : undefined;
}

const getNav = createServerFn({ method: "GET" }).handler(() => {
  const ordered = sortedDocs();

  function pagesIn(section: Section) {
    return ordered.flatMap((doc) =>
      doc.metadata.section === section
        ? [{ slug: doc.slug, title: doc.metadata.title }]
        : []
    );
  }

  const groups = [
    { pages: pagesIn(undefined), section: undefined },
    ...sections.map((section) => ({ pages: pagesIn(section), section })),
  ];

  return groups.filter((group) => group.pages.length > 0);
});

const getDoc = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(({ data: slug }) => {
    const doc = docs.get(slug);

    if (!doc) {
      throw notFound(notFoundHere);
    }

    const ordered = sortedDocs();
    const index = ordered.findIndex((entry) => entry.slug === doc.slug);

    return {
      ...doc,
      next: pageLink(ordered.at(index + 1)),
      previous: index > 0 ? pageLink(ordered.at(index - 1)) : undefined,
    };
  });

const getReference = createServerFn({ method: "GET" })
  .validator((params: ReferenceParams) => params)
  .handler(({ data: { kind, name, slug } }) => {
    const page = reference.get(`${slug}/${kind}/${name}`);

    if (!page) {
      throw notFound(notFoundHere);
    }

    return page;
  });

export { getDoc, getNav, getReference };
