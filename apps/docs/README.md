# docs

The tomekit documentation site, a TanStack Start app that reads its own content with tomekit.

```sh
vp dev     # serve at http://localhost:3000
vp build   # prerender to dist/
```

Pages live in `content/docs` as Markdown; frontmatter sets the title, description, section and order. `src/lib/api-reference.ts` generates the API pages from the library's build, so `pnpm build` in the repo root has to run first.

## Deploy

Cloudflare Workers through [Void](https://void.cloud), deployed by `.github/workflows/deploy-docs.yml` on every push to `main` that touches the docs or the library. `void.config.ts` holds the worker name, the `tomekit.aayush.cv` custom domain and the build command; Void keeps resource IDs in `void.lock.json`.

| Name | Kind | Value |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Repository secret | Token with Workers Scripts: Edit on the account |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | Repository variable | The account's workers.dev subdomain, eg `my-team` |

Deploy by hand with `vp run deploy` in this folder; the first run signs in to Cloudflare in the browser.
