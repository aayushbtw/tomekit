import { markdownNotFound } from "#/lib/markdown";

/** Anything that answers a request, eg the Worker's assets binding or the app's handler. */
interface Fetcher {
  fetch(request: Request): Promise<Response> | Response;
}

interface Origins {
  app: Fetcher;
  assets: Fetcher;
}

/** Each media range in an Accept header with its quality, eg `text/html;q=0.9`. */
function qualities(accept: string) {
  return new Map(
    accept.split(",").map((range) => {
      const [type = "", ...params] = range
        .split(";")
        .map((part) => part.trim().toLowerCase());
      const quality = params.find((param) => param.startsWith("q="));

      return [type, quality === undefined ? 1 : Number(quality.slice(2))];
    })
  );
}

/** Whether a client asked for Markdown by name, at least as much as HTML. `*\/*` alone still gets HTML. */
function prefersMarkdown(accept: string) {
  const ranges = qualities(accept);
  const markdown = ranges.get("text/markdown") ?? 0;
  const html =
    ranges.get("text/html") ?? ranges.get("text/*") ?? ranges.get("*/*") ?? 0;

  return markdown > 0 && markdown >= html;
}

function withVary(response: Response) {
  const varied = new Response(response.body, response);
  varied.headers.append("Vary", "Accept");

  return varied;
}

/**
 * Serves a page as HTML or, when the client prefers it, as the Markdown prerendered
 * next to it at `/index.md`. Anything else goes to the assets, then to the app.
 */
async function negotiate(request: Request, { app, assets }: Origins) {
  const url = new URL(request.url);
  const isPage = !/\.[^/]*$/u.test(url.pathname);
  const wantsMarkdown = prefersMarkdown(request.headers.get("Accept") ?? "");

  if (request.method !== "GET" && request.method !== "HEAD") {
    return await app.fetch(request);
  }

  if (isPage && wantsMarkdown) {
    const markdownUrl = new URL(
      `${url.pathname.replace(/\/$/u, "")}/index.md`,
      url
    );
    const markdown = await assets.fetch(new Request(markdownUrl, request));

    if (markdown.status === 404) {
      return markdownNotFound(url.pathname);
    }

    const response = withVary(markdown);
    response.headers.set("Content-Type", "text/markdown; charset=utf-8");

    return response;
  }

  const asset = await assets.fetch(request);
  const response = asset.status === 404 ? await app.fetch(request) : asset;

  if (wantsMarkdown && response.status === 404) {
    return markdownNotFound(url.pathname);
  }

  return isPage ? withVary(response) : response;
}

export { negotiate, prefersMarkdown };
export type { Fetcher };
