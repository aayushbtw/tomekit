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
  // Prerendered to `404.html`; also marked noindex in public/_headers.
  notFoundPath: "/404",
  repository: "https://github.com/aayushbtw/tomekit",
  // Also set as the custom domain in void.config.ts.
  url: homepage,
  version,
};

export { site };
