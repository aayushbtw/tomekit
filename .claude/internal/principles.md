# Principles

How to think before designing or recommending anything. `naming.md` says what things are called, `architecture.md` what was settled, `out-of-scope.md` what was left out and `experiments.md` what failed; this says how to decide. What users can see belongs in the docs site (`apps/docs`), not here.

## Recommend what is best

- Recommend what is correct for the library: best practice, most flexible, fully type safe, predictable. Rank options on quality alone.
- Never recommend the easy option, a shortcut, deferring work to save effort, or a silent fallback. An estimate is information, not a tiebreaker.
- When something is unverified, the plan is to verify it and design a proper fix if it fails, not to accept a weaker fallback.
- When a finding changes a recommendation, say so plainly, including that the earlier one was wrong.

## Don't contradict yourself

- One definition per concept. Two parts of the API must never give different answers to the same question, eg whether a document exists.
- Types describe exactly what runtime does. If the type says a value is present, the build guarantees it.
- One way to reach a result. Before adding a feature, check that it doesn't duplicate what existing members already compose to.
- Before recommending two features together, check each against the other for contradictions, not just each on its own.

## Reopen decisions that get in the way

- If a decision in these notes blocks the best API, name it, show what it costs, and propose reopening it. Don't narrow the API or loosen types to work around it.
- A design that avoids a decision is fine only when it is better on its own merits; say why.

## Learn from prior art

- For content features (loaders, schemas, transforms, references between collections), compare Astro content collections and content-collections, which solve the same problem. Other libraries are only a reference for general code quality.
- Read their source, not only their docs. Docs can contradict each other or the code.
- Take what they get right and fix what they get wrong, eg a check that only logs, or types that don't match behavior.

## Keep docs alive

- Delete a Markdown file once nothing in it is left to do, eg a todo list with every item ticked. Move anything still worth keeping, like a settled decision, into the right file here first, or into the docs site if users need it.
- No dead files: a doc that only records finished work is history, and git or the commit log already holds it.
- The why behind a specific line goes in a one-line comment next to it. These notes hold only what has no line to sit on: rejected options (`out-of-scope.md`), failed experiments (`experiments.md`) and settled design (`architecture.md`). Never both.

## Test designs before building

- Test a type-level design in a scratch project against the real source first, with passing and failing cases.
- Record what was tried and why it failed in `experiments.md`, so nobody retries it.
