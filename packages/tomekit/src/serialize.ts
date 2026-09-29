import { isFields, isList, isMap, isNumber, isSet } from "./value";
import type { ContentValue } from "./value";

/** Lets a bundler drop a call whose result is unused, eg a collection nobody imports. */
const PURE = "/*#__PURE__*/";

/**
 * A value as JSON text, when `JSON.parse` rebuilds it exactly, or else as
 * JavaScript source, so values JSON would drop or change (Dates, Maps, NaN,
 * `undefined`) come back as they went in.
 */
type Serialized = { json: string } | { source: string };

/** Whether `JSON.parse(JSON.stringify(value))` gives the same value back. Checks without building any text. */
function isJson(value: ContentValue): boolean {
  if (value === undefined) {
    return false;
  }

  if (isNumber(value)) {
    return Number.isFinite(value) && !Object.is(value, -0);
  }

  if (isList(value)) {
    // `JSON.parse` would read a hole back as `null`.
    return Array.from({ length: value.length }).every(
      (_, index) => index in value && isJson(value[index])
    );
  }

  if (isFields(value)) {
    return Object.values(value).every(isJson);
  }

  return !(
    isMap(value) ||
    isSet(value) ||
    value instanceof Date ||
    value instanceof URL ||
    value instanceof RegExp
  );
}

function serialize(value: ContentValue): Serialized {
  return isJson(value)
    ? { json: JSON.stringify(value) }
    : { source: write(value) };
}

// Single quotes, so the JSON's many `"` need no escaping.
function quoted(json: string): string {
  return `'${json.replaceAll(/['\\]/gu, "\\$&")}'`;
}

/** JavaScript source for one serialized value. `JSON.parse` of a string loads about twice as fast in V8 as the same object literal. */
function sourceOf(serialized: Serialized): string {
  return "json" in serialized
    ? `${PURE}JSON.parse(${quoted(serialized.json)})`
    : serialized.source;
}

/** JavaScript source for an array of serialized values: one `JSON.parse` when every item is JSON. */
function listSource(items: readonly Serialized[]): string {
  const json = items.flatMap((item) => ("json" in item ? [item.json] : []));

  return json.length === items.length
    ? `${PURE}JSON.parse(${quoted(`[${json.join(",")}]`)})`
    : `[${items.map(sourceOf).join(",")}]`;
}

function number(value: number): string {
  if (Number.isNaN(value)) {
    return "NaN";
  }

  if (!Number.isFinite(value)) {
    return value > 0 ? "Infinity" : "-Infinity";
  }

  return Object.is(value, -0) ? "-0" : String(value);
}

function write(value: ContentValue): string {
  if (value === undefined) {
    return "undefined";
  }

  if (isNumber(value)) {
    return number(value);
  }

  if (isList(value)) {
    const items = Array.from({ length: value.length }, (_, index) =>
      index in value ? write(value[index]) : ""
    );

    // A trailing hole needs its own comma: `[1,,]` has two items, `[1,]` one.
    const trailing =
      value.length > 0 && !(value.length - 1 in value) ? "," : "";

    return `[${items.join(",")}${trailing}]`;
  }

  if (isFields(value)) {
    const entries = Object.entries(value).map(
      // Computed, so a `__proto__` key stays a key instead of setting the prototype.
      ([key, entry]) => `[${JSON.stringify(key)}]:${write(entry)}`
    );

    return `{${entries.join(",")}}`;
  }

  if (isMap(value)) {
    const pairs = [...value].map(
      ([key, entry]) => `[${write(key)},${write(entry)}]`
    );

    return `${PURE}new Map([${pairs.join(",")}])`;
  }

  if (isSet(value)) {
    const entries = [...value].map((entry) => write(entry));

    return `${PURE}new Set([${entries.join(",")}])`;
  }

  if (value instanceof Date) {
    return `${PURE}new Date(${number(value.getTime())})`;
  }

  if (value instanceof URL) {
    return `${PURE}new URL(${JSON.stringify(value.href)})`;
  }

  if (value instanceof RegExp) {
    return `${PURE}new RegExp(${JSON.stringify(value.source)},${JSON.stringify(value.flags)})`;
  }

  return JSON.stringify(value);
}

export { listSource, PURE, serialize, type Serialized, sourceOf };
