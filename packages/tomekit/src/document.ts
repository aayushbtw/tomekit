import path from "node:path";

import {
  TransformMetadataError,
  TransformResultError,
  UnknownTransformFieldError,
} from "./errors";
import type { Source, TransformResult } from "./index";
import { isFileModule, modulePathOf } from "./module";
import { assertContentValue, isPlainObject } from "./value";
import type { ContentValue } from "./value";

const RESULT_FIELDS = new Set(["body", "metadata"]);

/** Checks what `transform` returned: an object with only `metadata` and/or `body`, and `metadata` an object. */
function assertTransformResult(
  result: unknown
): asserts result is TransformResult {
  if (!isPlainObject(result)) {
    throw new TransformResultError();
  }

  const unknownField = Object.keys(result).find(
    (field) => !RESULT_FIELDS.has(field)
  );

  if (unknownField !== undefined) {
    throw new UnknownTransformFieldError(unknownField);
  }

  if ("metadata" in result && !isPlainObject(result.metadata)) {
    throw new TransformMetadataError();
  }
}

/** A built document, and the file its body points at when the body is a module. */
interface BuildResult {
  document: ContentValue;
  /** Relative to the project root. */
  module: string | undefined;
}

/**
 * The document a source becomes once `transform` returned `result`: its
 * `metadata` and `body` replace the source's, and the rest stays. A module
 * body becomes its path.
 */
function buildDocument(
  source: Source<object>,
  result: TransformResult,
  root: string
): BuildResult {
  const body = "body" in result ? result.body : source.body;

  // Relative to the root and with `/`, so the same file always gets the same key in `importModule`.
  const module = isFileModule(body)
    ? path
        .relative(root, path.resolve(root, modulePathOf(body)))
        .split(path.sep)
        .join("/")
    : undefined;

  const document = {
    body: module ?? body,
    file: source.file,
    metadata: "metadata" in result ? result.metadata : source.metadata,
    slug: source.slug,
  };

  assertContentValue(document);

  return { document, module };
}

export { assertTransformResult, buildDocument, type BuildResult };
