/** A module's exports, as `import()` returns them. */
type ModuleExports = object;

/** React's `use()` reads these, so a promise that already settled renders without suspending again. */
interface TrackedPromise extends Promise<ModuleExports> {
  status?: "fulfilled";
  value?: ModuleExports;
}

/**
 * Builds `importModule` for the generated `tomekit/content-modules` module,
 * from a lazy import per module path.
 *
 * @internal
 */
function createImportModule(
  importers: ReadonlyMap<string, () => Promise<ModuleExports>>
): (module: string) => Promise<ModuleExports> {
  // One promise per module, so every caller, and every render, gets the same one.
  const imported = new Map<string, TrackedPromise>();

  async function track(promise: TrackedPromise) {
    try {
      promise.value = await promise;
      promise.status = "fulfilled";
    } catch {
      // The caller awaits the same promise, so the error reaches it there.
    }
  }

  // oxlint-disable-next-line typescript/promise-function-async -- Returns the cached promise itself, which `use()` needs to see again; `async` would wrap it in a new one.
  return function importModule(module) {
    const cached = imported.get(module);

    if (cached !== undefined) {
      return cached;
    }

    const importer = importers.get(module);

    // A plain TypeError: this runs inside the generated file, which imports nothing, so no tomekit error class is in scope.
    const promise: TrackedPromise =
      importer === undefined
        ? Promise.reject(
            new TypeError(
              `no module at "${module}". Pass a document's body, and rebuild if the file was just added.`
            )
          )
        : importer();

    imported.set(module, promise);
    void track(promise);

    return promise;
  };
}

export { createImportModule };
