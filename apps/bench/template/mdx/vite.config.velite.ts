import { build } from "velite";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

/** Velite has no Vite plugin; its docs run `build()` next to the dev server, which this does from `buildStart`. */
function velite(dev: boolean): Plugin {
  let started: Promise<unknown> | undefined;

  return {
    async buildStart() {
      // No `clean`: a cold run already starts without `.velite`, and a warm one keeps it, as for the others.
      started ??= build({ logLevel: "silent", watch: dev });
      await started;
    },
    name: "velite",
  };
}

export default defineConfig(({ command }) => ({
  plugins: [velite(command === "serve")],
}));
