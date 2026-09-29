import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BENCH = path.resolve(import.meta.dirname, "..");

const SCENARIOS = ["plain", "markdown"] as const;

/** `plain` validates frontmatter only; `markdown` also renders each body to HTML with the same library in every tool. */
type Scenario = (typeof SCENARIOS)[number];

function post(index: number): string {
  const id = String(index).padStart(5, "0");

  return `---
title: Post ${id}
date: "2026-01-${String((index % 28) + 1).padStart(2, "0")}"
tags: [tag-${index % 7}, tag-${index % 13}]
draft: false
description: A generated post for the benchmark, number ${id}.
---

# Post ${id}

Content collections turn a folder of Markdown into typed data. This paragraph
is filler so each body is a realistic size, with **bold**, _emphasis_ and a
[link](https://example.com/${id}).

## A list

- The first item, with \`inline code\`
- The second item
- The third item, which runs a little longer than the others

## Some code

\`\`\`ts
export function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

## A table

| Name | Value |
| --- | --- |
| id | ${id} |
| group | ${index % 7} |

> A blockquote to finish, so the parser sees one of everything.
`;
}

/** A project folder with `size` posts, the templates for `scenario` and every tool's entry. */
async function fixture(size: number, scenario: Scenario): Promise<string> {
  const root = path.join(BENCH, ".fixtures", String(size));
  const posts = path.join(root, "content", "posts");
  await mkdir(posts, { recursive: true });
  const existing = await readdir(posts);

  if (existing.length !== size) {
    await Promise.all(
      Array.from({ length: size }, (_, index) =>
        writeFile(
          path.join(posts, `post-${String(index).padStart(5, "0")}.md`),
          post(index)
        )
      )
    );
  }

  await cp(path.join(BENCH, "template", "entries"), root, { recursive: true });
  await cp(path.join(BENCH, "template", scenario), root, { recursive: true });

  return root;
}

export { fixture, type Scenario, SCENARIOS };
