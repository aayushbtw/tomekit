# docs

The tomekit documentation site, a TanStack Start app that reads its own content with tomekit.

```sh
vp run dev     # serve at http://localhost:3000
vp run build   # prerender to dist/client
```

Pages live in `content/docs` as Markdown; frontmatter sets the title, description, section and order. `src/lib/api-reference.ts` generates the API pages from the library's build, which both tasks run first.

## Deploy

Static files on Cloudflare through [Void](https://void.cloud), deployed by `.github/workflows/void-deploy.yml` on every push to `main` that touches the docs or the library. `void.config.ts` holds the worker name, the `tomekit.aayush.cv` custom domain and the build command; Void keeps resource IDs in `void.lock.json`.

Server functions are saved as JSON while prerendering (`src/start.ts`), so links work without a server. `404.html` is the not-found page, served for every path with no file.

The workflow needs a `CLOUDFLARE_API_TOKEN` repository secret: a token with Workers Scripts: Edit on the account.

Deploy by hand with `vp run deploy` in this folder; the first run signs in to Cloudflare in the browser.
