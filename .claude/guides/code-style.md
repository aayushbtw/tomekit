# Code style

Lint is oxlint with anti-slop (vendored in `tools/oxlint/anti-slop/`) and a short explicit rule list in the root `vite.config.ts`, no preset. Anti-slop always wins:

- Never turn off, loosen or suppress an anti-slop rule. Change the code.
- When another rule conflicts with anti-slop, turn that rule off in the root `vite.config.ts` with a one-line reason.
- Add a rule when it would have caught a real problem, not because a preset has it.
- Unknown input is checked once at its boundary with an assertion or type predicate (eg `assertContentValue`), then handled as a named type. No `typeof`; tell primitives apart by boxing them (`new Object(value) instanceof Number`).
- A parameter typed `unknown` is only allowed when it is named `cause` or is a type predicate's subject.

Also enforced by lint, so write them up front: `interface` for object shapes (`type` only for unions, function, mapped and conditional types), function declarations over arrow consts, `async`/`await` over `.then`, sorted object keys, no `any` or unsafe assertions (in tests too).

- Types inferred from user schemas are wrapped once in `Prettify`, so errors print flat fields. Use `PrettifyIfPlainObject` where a value might be an array or a built-in (Date, Map, Set, RegExp). Don't generate named interfaces to work around this.
- Helper types that exist only for generated code or the type system get `@internal`.
- Options objects with defaults go in the signature: `function tomekit({ config = "tomekit.config.ts" }: TomekitOptions = {})`.

