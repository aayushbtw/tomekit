import { docs } from "tomekit/content";
import type { DocumentOf } from "tomekit/content";

import { sections } from "#/lib/sections";

type Section = DocumentOf<"docs">["metadata"]["section"];

/** A page with no section is a link of its own, above the sections. */
function sectionRank(section: Section) {
  return section === undefined ? -1 : sections.indexOf(section);
}

function compareDocs(a: DocumentOf<"docs">, b: DocumentOf<"docs">) {
  const bySection =
    sectionRank(a.metadata.section) - sectionRank(b.metadata.section);

  return bySection === 0 ? a.metadata.order - b.metadata.order : bySection;
}

// Its own module so only server code imports it: exported from a module the browser
// loads, it would keep `tomekit/content` in the browser bundle.
function sortedDocs() {
  return docs.documents().toSorted(compareDocs);
}

export { sortedDocs };

export type { Section };
