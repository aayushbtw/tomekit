---
title: Known slugs
description: posts.get() knows which slugs exist.
publishedAt: 2026-09-15
---

`posts.get("hello-world")` returns a document, and `posts.get("hello-wrld")` doesn't compile.

A slug from the URL is a plain `string`, so `posts.get(params.slug)` may return `undefined`, and the page answers with a 404.
