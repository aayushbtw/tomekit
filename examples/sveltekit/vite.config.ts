import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import { tomekit } from "tomekit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tomekit(),
    sveltekit({
      adapter: adapter(),
      compilerOptions: {
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
      typescript: {
        // SvelteKit writes compilerOptions.paths, so tomekit's types are added here instead of in tsconfig.json.
        config: (config) => {
          config.compilerOptions.paths["tomekit/content"] = [
            "../.tomekit/content",
          ];
          config.compilerOptions.paths["tomekit/content*"] = [
            "../.tomekit/content*",
          ];
        },
      },
    }),
  ],
});
