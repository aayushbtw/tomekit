# Code style

- Unknown input is checked once at its boundary with an assertion or type predicate (eg `assertContentValue`), then handled as a named type. No `typeof`; tell primitives apart by boxing them (`new Object(value) instanceof Number`).
- A parameter typed `unknown` is only allowed when it is named `cause` or is a type predicate's subject.
- `interface` for object shapes; `type` only for unions, function, mapped and conditional types.
- Function declarations over arrow consts; `async`/`await` over `.then`; no `any` or unsafe assertions (in tests too).
- Types inferred from user schemas are wrapped once in `Prettify`, so errors print flat fields. Use `PrettifyIfPlainObject` where a value might be an array or a built-in (Date, Map, Set, RegExp). Don't generate named interfaces to work around this.
- Helper types that exist only for generated code or the type system get `@internal`.
- Options objects with defaults go in the signature: `function tomekit({ config = "tomekit.config.ts" }: TomekitOptions = {})`.
