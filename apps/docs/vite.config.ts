import path from "node:path";

import stylex from "@stylexjs/unplugin/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";
import { voidPlugin } from "void";

const config = defineConfig({
  plugins: lazyPlugins(async () => {
    // Tests cover plain modules, and the Cloudflare plugin would run them in workerd.
    if (process.env.VITEST !== undefined) {
      return [];
    }

    // Imported lazily: `vp run` reads this config before tomekit's dist is built.
    const { tomekit } = await import("tomekit/vite");

    // oxlint-disable-next-line typescript/no-unsafe-return -- `@stylexjs/unplugin/vite` is typed as returning `any`; its typed factory skips the Vite hooks that emit CSS.
    return [
      tomekit(),
      voidPlugin(),
      tanstackStart({
        // Crawling only follows links, and no page links to these.
        pages: [{ path: "/robots.txt" }, { path: "/sitemap.xml" }],
        prerender: { crawlLinks: true, enabled: true },
      }),
      // Before the React plugin, or Fast Refresh breaks.
      stylex({
        aliases: { "#/*": [path.join(import.meta.dirname, "src/*")] },
        useCSSLayers: true,
      }),
      viteReact(),
    ];
  }),
  resolve: { tsconfigPaths: true },
  run: {
    tasks: {
      // The API reference pages are loaded from tomekit's build.
      build: { command: "vp build", dependsOn: ["tomekit#build"] },
      dev: {
        cache: false,
        command: "vp dev --port 3000",
        dependsOn: ["tomekit#build"],
      },
    },
  },
});

export default config;
