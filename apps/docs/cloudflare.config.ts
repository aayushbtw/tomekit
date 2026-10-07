import { bindings, defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    assets: {
      // Prerender writes a directory index per route while the router links without
      // a trailing slash, so the default would 307 on every deep link.
      htmlHandling: "drop-trailing-slash",
      // Pages pass through the worker so it can answer `Accept: text/markdown`.
      // Hashed build files never need it.
      runWorkerFirst: ["/*", "!/assets/*"],
    },
    compatibilityDate: "2026-09-16",
    compatibilityFlags: ["nodejs_compat"],
    domains: ["tomekit.aayush.cv"],
    entrypoint: "./src/server.ts",
    env: { ASSETS: bindings.assets() },
    name: "tomekit-docs",
    // A prerendered docs site serves almost everything from assets, so a log per
    // request is noise. 1% is enough to see the worker is alive and erroring.
    observability: {
      logs: { enabled: true, headSamplingRate: 0.01, invocationLogs: false },
      traces: { enabled: false },
    },
    previewUrls: false,
    workersDev: false,
  },
});
