import { TransformError } from "./transform-error";

/** A `transform` returned `metadata` that isn't a plain object. */
class TransformMetadataError extends TransformError {
  override name = "TransformMetadataError";

  constructor() {
    super(
      "transform returned `metadata` that isn't an object. Return an object, eg `{ metadata: { ...metadata, url } }`."
    );
  }
}

export { TransformMetadataError };
