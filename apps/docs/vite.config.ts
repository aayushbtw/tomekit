import path from "node:path";

import stylex from "@stylexjs/unplugin/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

import { site } from "./src/lib/site";

const config = defineConfig({
  plugins: lazyPlugins(async () => {
    // Tests cover plain modules, and the plugins keep Vitest's servers from closing.
    if (process.env.VITEST !== undefined) {
      return [];
    }

    // Imported lazily: `vp run` reads this config before tomekit's dist is built.
    const { tomekit } = await import("tomekit/vite");

    // oxlint-disable-next-line typescript/no-unsafe-return -- `@stylexjs/unplugin/vite` is typed as returning `any`; its typed factory skips the Vite hooks that emit CSS.
    return [
      tomekit(),
      tanstackStart({
        // Crawling only follows links, and no page links to these.
        pages: [
          { path: site.notFoundPath },
          { path: "/llms.txt" },
          { path: "/robots.txt" },
          { path: "/sitemap.xml" },
        ],
        // `errors.html`, not `errors/index.html`: void's static deploy forces auto trailing
        // slashes, which redirect a directory index to `/errors/` but serve a file as is.
        // Until voidzero-dev/void#580 lets `html_handling` through.
        prerender: {
          autoSubfolderIndex: false,
          crawlLinks: true,
          enabled: true,
        },
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
