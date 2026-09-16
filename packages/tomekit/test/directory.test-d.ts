// Checked by `pnpm check`, never run: each line fails to compile if inference breaks.
import { z } from "zod";

import { defineCollection, directory } from "../src/index";

// Globs suggest common patterns but accept any string.
export const globbed = defineCollection({
  loader: directory("content/notes", {
    exclude: ["drafts/**"],
    include: "**/*.markdown",
  }),
  schema: z.object({}),
});
