import { defineConfig } from "void/config";

export default defineConfig({
  cloudflare: {
    assets: {
      // Prerender writes a directory index per route while the router links without
      // a trailing slash, so the default would 307 on every deep link.
      html_handling: "drop-trailing-slash",
    },
    name: "tomekit-docs",
    // A prerendered docs site serves almost everything from assets, so a log per
    // request is noise. 1% is enough to see the worker is alive and erroring.
    observability: {
      logs: { enabled: true, head_sampling_rate: 0.01, invocation_logs: false },
      traces: { enabled: false },
    },
    preview_urls: false,
    routes: [{ custom_domain: true, pattern: "tomekit.aayush.cv" }],
    workers_dev: false,
  },
  // Not `vp run build`: Vite+ tasks drop env vars they don't declare, including Void's deploy-build flags.
  // The API reference pages need tomekit packed first; the deploy workflow does that.
  inference: { build: "vp build" },
  // TanStack Start prerenders at build time, so there's nothing for an ISR cache to hold.
  routing: { isr: false },
  worker: {
    compatibility_date: "2026-09-16",
    compatibility_flags: ["nodejs_compat"],
  },
});
