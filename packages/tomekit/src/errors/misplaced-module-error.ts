import { TransformError } from "./transform-error";

/** A `transform` returned a `fileModule()` somewhere other than `body`. */
class MisplacedModuleError extends TransformError {
  override name = "MisplacedModuleError";

  /** `at` is the key path, eg `metadata.intro`. */
  constructor(at: string) {
    super(
      `transform returned a fileModule() at ${at}, but a module can only be a document's body. Return it as \`body\`.`
    );
  }
}

export { MisplacedModuleError };
