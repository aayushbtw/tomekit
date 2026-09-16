# docs

The tomekit documentation site, a TanStack Start app that reads its own content with tomekit.

```sh
vp dev     # serve at http://localhost:3000
vp build   # prerender to dist/
```

Pages live in `content/docs` as Markdown; frontmatter sets the title, description, section and order. `src/lib/api-reference.ts` generates the API pages from the library's build, so `pnpm build` in the repo root has to run first.
