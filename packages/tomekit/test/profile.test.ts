import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { run } from "../src/cli";
import type { CliLogger } from "../src/cli";
import { PHASES, STAGES } from "../src/profile";
import { createProject, SOURCE } from "./project";

const config = `
import { z } from "zod";
import { defineConfig, directory } from ${JSON.stringify(SOURCE)};

export default defineConfig({
  collections: {
    posts: {
      loader: directory("content/posts"),
      schema: z.strictObject({ title: z.string() }),
    },
  },
});
`;

let cleanup: (() => Promise<void>) | undefined;

afterEach(async () => {
  vi.unstubAllEnvs();
  performance.clearMeasures("tomekit");
  await cleanup?.();
});

async function build(): Promise<string> {
  const project = await createProject({
    "content/posts/hello.md": "---\ntitle: Hello\n---\n",
    "tomekit.config.ts": config,
  });

  ({ cleanup } = project);
  const lines: string[] = [];

  function record(message: string) {
    lines.push(message);
  }

  const logger: CliLogger = { error: record, info: record, warn: record };

  await expect(run(["build"], { logger, root: project.root })).resolves.toBe(0);

  return lines.join("\n");
}

describe("TOMEKIT_PROFILE", () => {
  it("prints where the build's time went, naming every stage and phase", async () => {
    vi.stubEnv("TOMEKIT_PROFILE", "1");
    const output = await build();

    expect(output).toContain("[tomekit] profile of a build of 1 documents in");

    for (const name of [...STAGES, ...PHASES]) {
      expect(output).toMatch(new RegExp(`^ +${name} +[\\d.]+ ms`, "mu"));
    }

    expect(output).toMatch(/^ {4}parse +[\d.]+ ms {2}1 files$/mu);
  });

  it("records each build as a tomekit performance measure", async () => {
    vi.stubEnv("TOMEKIT_PROFILE", "1");
    await build();
    const [measure] = performance.getEntriesByName("tomekit", "measure");

    expect(measure).toMatchObject({
      detail: {
        documents: 1,
        stages: STAGES.map((name) => ({ name })),
      },
    });
  });

  it.each([undefined, "", "0"])("is off when set to %j", async (value) => {
    vi.stubEnv("TOMEKIT_PROFILE", value);

    await expect(build()).resolves.not.toContain("profile");
    expect(performance.getEntriesByName("tomekit")).toHaveLength(0);
  });
});
