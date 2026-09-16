// Checked by `pnpm check`, never run: each line fails to compile if inference breaks.
import { ContentError } from "../src/index";
import type { ContentSubject, Issue } from "../src/index";

// A `ContentError` can be built from the exported subject and issue types.
const subject: ContentSubject = { collection: "pages", slug: "a" };

const issue: Issue = { line: 1, message: "title: expected a string" };

export const contentMessage: string = new ContentError(subject, issue).message;
