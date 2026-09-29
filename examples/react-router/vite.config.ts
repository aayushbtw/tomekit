import { reactRouter } from "@react-router/dev/vite";
import { tomekit } from "tomekit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tomekit(), reactRouter()],
  resolve: { tsconfigPaths: true },
});
