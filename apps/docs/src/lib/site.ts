import {
  description,
  homepage,
  name,
  version,
} from "../../../../packages/tomekit/package.json";

const site = {
  description,
  name,
  // Also set as the custom domain in cloudflare.config.ts.
  url: homepage,
  version,
};

export { site };
