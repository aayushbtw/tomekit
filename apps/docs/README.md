# docs

The tomekit documentation site, a TanStack Start app that reads its own content with tomekit.

```sh
vp dev     # serve at http://localhost:3000
vp build   # prerender to dist/
```

Pages live in `content/docs` as Markdown; frontmatter sets the title, description, section and order. `src/lib/api-reference.ts` generates the API pages from the library's build, so `pnpm build` in the repo root has to run first.

## Deploy

Cloudflare Workers, built and deployed by Workers Builds on every push to `main`. `wrangler.jsonc` holds the worker name and the `tomekit.aayush.cv` custom domain, so the domain and its DNS record are created by the deploy, not by hand.

The build settings in the dashboard (Workers & Pages → tomekit-docs → Settings → Builds):

| Setting        | Value                                    |
| -------------- | ---------------------------------------- |
| Root directory | `apps/docs`                              |
| Build command  | `cd ../.. && pnpm install && pnpm build` |
| Deploy command | `pnpm exec wrangler deploy`              |

The build runs from the repo root because `vp run -r build` has to pack `tomekit` before the site can read its API reference. `.node-version` pins the build image to Node 24.
