# Releases

- Every `fix` or `feat` commit that users can notice adds a `.changeset/*.md` in the same commit, written for users. A breaking change is `minor` before 1.0 and starts with `**Breaking:**`, since Changesets groups notes by bump type.
- A release is `vpr release` (`changeset version`, which bumps `packages/tomekit/package.json` and writes its `CHANGELOG.md`), committed as `chore(release): x.y.z` and pushed to main. `release.yml` publishes any version not on npm, then tags it and creates the GitHub Release from that `CHANGELOG.md` section. Nobody pushes tags by hand.
- No release PR and no `changesets/action`: it opens a PR whenever pending changesets reach main, which slows things down before 1.0.
- PRs never bump the version; merging one that does publishes it.

