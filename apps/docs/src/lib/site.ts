import {
  description,
  homepage,
  name,
  version,
} from "../../../../packages/tomekit/package.json";

const site = {
  description,
  name,
  // Also set as the custom domain in wrangler.jsonc, which can't import it.
  url: homepage,
  version,
};

export { site };
