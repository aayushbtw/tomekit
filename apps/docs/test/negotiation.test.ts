import { describe, expect, it } from "vite-plus/test";

import { negotiate, prefersMarkdown } from "#/lib/negotiation";
import type { Fetcher } from "#/lib/negotiation";

const browserAccept =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

const files = new Map([
  ["/index.html", "<h1>Getting started</h1>"],
  ["/index.md", "# Getting started"],
  ["/reading/index.md", "# Reading"],
  ["/og.png", "png"],
]);

/** The assets binding over `files`: a page path serves its `index.html`. */
const assets: Fetcher = {
  fetch(request) {
    const { pathname } = new URL(request.url);
    const file =
      files.get(pathname) ??
      files.get(`${pathname.replace(/\/$/u, "")}/index.html`);

    return file === undefined
      ? new Response("", { status: 404 })
      : new Response(file, { headers: { "Content-Type": "text/html" } });
  },
};

const app: Fetcher = {
  fetch: () => new Response("<h1>Page not found</h1>", { status: 404 }),
};

async function get(path: string, accept: string) {
  return await negotiate(
    new Request(new URL(path, "https://tomekit.aayush.cv"), {
      headers: { Accept: accept },
    }),
    { app, assets }
  );
}

describe(prefersMarkdown, () => {
  it.each([
    "text/markdown",
    "text/markdown, text/html;q=0.9",
    "text/html;q=0.5, text/markdown",
  ])("is true for %s", (accept) => {
    expect(prefersMarkdown(accept)).toBeTruthy();
  });

  it.each([
    browserAccept,
    "*/*",
    "",
    "text/html, text/markdown;q=0.5",
    "text/markdown;q=0",
  ])("is false for %s", (accept) => {
    expect(prefersMarkdown(accept)).toBeFalsy();
  });
});

describe(negotiate, () => {
  it("serves the home page as Markdown", async () => {
    const response = await get("/", "text/markdown");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(response.headers.get("Vary")).toBe("Accept");
    await expect(response.text()).resolves.toBe("# Getting started");
  });

  it.each(["/reading", "/reading/"])(
    "serves a doc page as Markdown at %s",
    async (path) => {
      const response = await get(path, "text/markdown");

      await expect(response.text()).resolves.toBe("# Reading");
    }
  );

  it("serves HTML to browsers, varying on Accept", async () => {
    const response = await get("/", browserAccept);

    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(response.headers.get("Vary")).toBe("Accept");
    await expect(response.text()).resolves.toBe("<h1>Getting started</h1>");
  });

  it("answers a missing page with a Markdown 404 that links the page index", async () => {
    const response = await get("/missing", "text/markdown");

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8"
    );
    await expect(response.text()).resolves.toContain(
      "https://tomekit.aayush.cv/llms.txt"
    );
  });

  it("leaves a missing page's HTML 404 to the app", async () => {
    const response = await get("/missing", browserAccept);

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("<h1>Page not found</h1>");
  });

  it("serves files as they are", async () => {
    const response = await get("/og.png", "text/markdown");

    expect(response.headers.get("Vary")).toBeNull();
    await expect(response.text()).resolves.toBe("png");
  });
});
