import { defineConfig } from "void/config";

export default defineConfig({
  cloudflare: {
    name: "tomekit-docs",
    observability: {
      logs: { enabled: true, head_sampling_rate: 0.01, invocation_logs: false },
      traces: { enabled: false },
    },
    preview_urls: false,
    routes: [{ custom_domain: true, pattern: "tomekit.aayush.cv" }],
    workers_dev: false,
  },
  inference: {
    appType: "static",
    build: "vp run build",
    outputDir: "dist/client",
  },
  worker: { compatibility_date: "2026-09-16" },
});
