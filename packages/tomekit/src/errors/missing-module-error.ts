import { TransformError } from "./transform-error";

/** A `fileModule()` points at a file that does not exist. */
class MissingModuleError extends TransformError {
  override name = "MissingModuleError";

  /** `path` is what was passed to `fileModule()`. */
  constructor(path: string) {
    super(
      `fileModule(${JSON.stringify(path)}) points at a file that does not exist. Pass a path relative to the project root, eg \`file.path\`.`
    );
  }
}

export { MissingModuleError };
