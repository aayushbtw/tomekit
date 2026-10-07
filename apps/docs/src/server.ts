import handler from "@tanstack/react-start/server-entry";

import { negotiate } from "#/lib/negotiation";
import type { Fetcher } from "#/lib/negotiation";

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env) {
    return await negotiate(request, { app: handler, assets: env.ASSETS });
  },
};
