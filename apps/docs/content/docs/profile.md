---
title: Profile
description: See where a build's time goes.
section: Tools
order: 3
---

Set `TOMEKIT_PROFILE=1` to print where each build's time went. It works the same with the Vite plugin, `tomekit build`, `tomekit watch` and `tomekit/register`:

```sh title="Terminal"
TOMEKIT_PROFILE=1 vite build
```

```txt title="Output"
[tomekit] profile of a build of 1000 documents in 319.1 ms
  config            75.5 ms
  collections      235.0 ms
    parse           21.9 ms  1000 files
    validate         2.9 ms
    transform       75.7 ms  1000 entries
    serialize       13.9 ms
    hash             0.0 ms
    other          120.5 ms  reading files, loaders, code after an await
  references         0.6 ms
  generate           3.2 ms
  write              4.6 ms
  other              0.1 ms
Stages add up to the total. Indented phases are CPU time summed over entries, and add up to collections.
```

The unindented rows are stages. They run one after another, so they add up to the total:

- `config`: importing `tomekit.config.ts`, only when it or a file it imports changed.
- `collections`: running every loader, schema and transform.
- `references`: checking [references](/collections#references) between collections.
- `generate`: building the `tomekit/content` module.
- `write`: writing `.tomekit/`, including the types.

The indented rows split `collections`. Entries are built in parallel, so each row is the time spent in that step, added up over every entry:

- `parse`: reading frontmatter with `directory()`. In dev, only files that changed are parsed; the rest count as reused.
- `validate`: your schema.
- `transform`: your `transform`. In dev, entries that didn't change are reused without calling it.
- `serialize`: checking and serializing documents for the module.
- `hash`: telling changed entries apart in dev.
- `other`: what is left, mostly waiting on files and your loaders. A step that awaits something counts only up to its first `await`, so the rest of an async `transform` lands here too.

With the Vite plugin, the rest of `vite build` is Vite's own work, eg bundling your app.

Tools can read the same numbers without parsing the text: each build is recorded as a `performance.measure` named `tomekit`, with the rows in its `detail`.
