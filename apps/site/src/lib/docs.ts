import { notFound, rootRouteId } from "@tanstack/react-router";
import type { NotFoundError } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { collections } from "tomekit/content";
import type { DocumentOf } from "tomekit/content";

import { sections } from "#/lib/sections";

type Section = DocumentOf<"docs">["metadata"]["section"];

/** A reference page's route params: its index page's slug, its kind's folder and its name. */
interface ReferenceParams {
  kind: string;
  name: string;
  slug: string;
}

// The root route, not this one: a 404 replaces the docs layout instead of rendering inside it.
const notFoundHere: NotFoundError = { routeId: rootRouteId };

/** A page with no section is a link of its own, above the sections. */
function sectionRank(section: Section) {
  return section === undefined ? -1 : sections.indexOf(section);
}

function compareDocs(a: DocumentOf<"docs">, b: DocumentOf<"docs">) {
  const bySection =
    sectionRank(a.metadata.section) - sectionRank(b.metadata.section);

  return bySection === 0 ? a.metadata.order - b.metadata.order : bySection;
}

function sortedDocs() {
  return collections.get("docs").documents().toSorted(compareDocs);
}

function pageLink(doc: DocumentOf<"docs"> | undefined) {
  return doc ? { slug: doc.slug, title: doc.metadata.title } : undefined;
}

const getNav = createServerFn({ method: "GET" }).handler(() => {
  const docs = sortedDocs();

  function pagesIn(section: Section) {
    return docs.flatMap((doc) =>
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
    const doc = collections.get("docs").get(slug);

    if (!doc) {
      throw notFound(notFoundHere);
    }

    const docs = sortedDocs();
    const index = docs.findIndex((entry) => entry.slug === doc.slug);

    return {
      ...doc,
      next: pageLink(docs.at(index + 1)),
      previous: index > 0 ? pageLink(docs.at(index - 1)) : undefined,
    };
  });

const getReference = createServerFn({ method: "GET" })
  .validator((params: ReferenceParams) => params)
  .handler(({ data: { kind, name, slug } }) => {
    const page = collections.get("reference").get(`${slug}/${kind}/${name}`);

    if (!page) {
      throw notFound(notFoundHere);
    }

    return page;
  });

export { getDoc, getNav, getReference };
