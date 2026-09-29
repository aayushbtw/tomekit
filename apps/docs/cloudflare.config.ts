import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    // Prerender writes a directory index per route while the router links without
    // a trailing slash, so the default would 307 on every deep link.
    assets: { htmlHandling: "drop-trailing-slash" },
    compatibilityDate: "2026-09-16",
    compatibilityFlags: ["nodejs_compat"],
    domains: ["tomekit.aayush.cv"],
    entrypoint: "@tanstack/react-start/server-entry",
    name: "tomekit-docs",
    // A prerendered docs site serves almost everything from assets, so a log per
    // request is noise. 1% is enough to see the worker is alive and erroring.
    observability: {
      enabled: true,
      headSamplingRate: 0.01,
      logs: { invocationLogs: false },
    },
  },
});
