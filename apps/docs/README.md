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

| Setting | Value |
| --- | --- |
| Root directory | `apps/docs` |
| Build command | `pnpm exec vp run build` |
| Deploy command | `pnpm exec wrangler deploy` |
| Include paths | `apps/docs/*`, `packages/tomekit/src/*`, `packages/tomekit/package.json`, `pnpm-lock.yaml` |
| Exclude paths | `apps/docs/README.md` |

Workers Builds installs from the lockfile before the build command runs, and pnpm installs the whole workspace from any package in it, so the build needs no `cd` to the root. `vp run build` then packs `tomekit` first through its `dependsOn`. Watch paths are relative to the repo root rather than the root directory, and the library is in them because the API reference pages come from its build. `.node-version` pins the build image to Node 24.
