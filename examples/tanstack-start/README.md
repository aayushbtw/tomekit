# tomekit + TanStack Start

A blog whose posts are Markdown files in `content/posts`, validated and rendered at build time by [tomekit](https://tomekit.aayush.cv). Pages read them through server functions (`src/server/posts.ts`), so only what a page renders reaches the browser.

[Open in StackBlitz](https://stackblitz.com/github/aayushbtw/tomekit/tree/main/examples/tanstack-start)

```sh
npm install
npm run dev
```

The config is `tomekit.config.ts`. Add a key to a post's frontmatter that the schema doesn't know, eg `titel: Hi`, to see the build point at the file, line and column.
