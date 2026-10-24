import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { site } from "#/lib/site";

// Prerender rejects a 404, so the not-found page it writes to `404.html` is answered as a 200.
// The host serves that file with a 404 for every path with no file.
export default createServerEntry({
  async fetch(request, options) {
    const response = await handler.fetch(request, options);

    return new URL(request.url).pathname === site.notFoundPath &&
      response.status === 404
      ? new Response(response.body, { headers: response.headers, status: 200 })
      : response;
  },
});
