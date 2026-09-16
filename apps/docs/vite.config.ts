import { cloudflare } from "@cloudflare/vite-plugin";
import stylex from "@stylexjs/unplugin/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

const config = defineConfig({
  plugins: lazyPlugins(async () => {
    // Imported lazily: `vp run` reads this config before tomekit's dist is built.
    const { tomekit } = await import("tomekit/vite");

    return [
      tomekit(),
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tanstackStart({
        // Crawling only follows links, and no page links to these.
        pages: [{ path: "/robots.txt" }, { path: "/sitemap.xml" }],
        prerender: { crawlLinks: true, enabled: true },
      }),
      // Before the React plugin, or Fast Refresh breaks.
      stylex({ useCSSLayers: true }),
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
