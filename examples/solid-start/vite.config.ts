import { solidStart } from "@solidjs/start/config";
import { nitro } from "nitro/vite";
import { tomekit } from "tomekit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tomekit(), solidStart(), nitro()],
});
