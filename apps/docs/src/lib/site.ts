import { version } from "../../../../packages/tomekit/package.json";

const site = {
  name: "tomekit",
  description: "Fully typed content collections for Markdown.",
  // Also set as the custom domain in wrangler.jsonc, which can't import it.
  url: "https://tomekit.aayush.cv",
  version,
};

export { site };
