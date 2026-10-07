import {
  description,
  homepage,
  license,
  name,
  version,
} from "../../../../packages/tomekit/package.json";

const site = {
  author: { name: "Aayush", url: "https://x.com/aayushbtw" },
  description,
  license,
  name,
  repository: "https://github.com/aayushbtw/tomekit",
  // Also set as the custom domain in cloudflare.config.ts.
  url: homepage,
  version,
};

export { site };
