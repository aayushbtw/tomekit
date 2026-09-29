---
title: Typed frontmatter
description: Every field has a type, and a typo fails the build.
publishedAt: 2026-09-08
---

The schema is a strict object, so a key it doesn't know, eg `titel`, fails the build with the file, line and column.

`publishedAt` is written as `2026-09-08` and read as a `Date`, because the schema coerces it.
