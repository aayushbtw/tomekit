---
"tomekit": minor
---

Set `TOMEKIT_PROFILE=1` to print where each build's time goes: importing the config, each collection's parse, schema, transform and serialize, references, and writing `.tomekit/`. Works with the Vite plugin, `tomekit build`, `tomekit watch` and `tomekit/register`. Each build is also recorded as a `tomekit` performance measure.
