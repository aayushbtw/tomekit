import {
  MisplacedModuleError,
  UnserializableInstanceError,
  UnserializableValueError,
} from "./errors";
import {
  isBigInt,
  isFunction,
  isObject,
  isPrimitive,
  isString,
  isSymbol,
} from "./kind";
import { isFileModule } from "./module";

const IDENTIFIER = /^[$_\p{ID_Start}][$\p{ID_Continue}]*$/u;

const PLAIN_PROTOTYPES = new Set<object | null>([Object.prototype, null]);

/** A value tomekit can write into a generated module, as `transform` output or parsed frontmatter. */
type ContentValue =
  | ContentFields
  | Date
  | ReadonlyMap<ContentValue, ContentValue>
  | ReadonlySet<ContentValue>
  | RegExp
  | URL
  | boolean
  | number
  | readonly ContentValue[]
  | string
  | null
  | undefined;

interface ContentFields {
  readonly [key: string]: ContentValue;
}

/** Whether a value is an object literal, rather than a primitive, array or instance of a class. */
function isPlainObject(value: unknown): value is object {
  if (!isObject(value)) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return (
    !Array.isArray(value) &&
    (prototype === Object.prototype || prototype === null)
  );
}

function isList(value: ContentValue): value is readonly ContentValue[] {
  return Array.isArray(value);
}

function isMap(
  value: ContentValue
): value is ReadonlyMap<ContentValue, ContentValue> {
  return value instanceof Map;
}

function isSet(value: ContentValue): value is ReadonlySet<ContentValue> {
  return value instanceof Set;
}

// Called only on checked values, so an object that is none of the other kinds is a plain object.
function isFields(value: ContentValue): value is ContentFields {
  return (
    isObject(value) &&
    !isList(value) &&
    !isMap(value) &&
    !isSet(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp) &&
    !(value instanceof URL)
  );
}

/** An object key, or an index into an array, Set or Map entry. */
type PathSegment = number | string;

/** Where `key` sits inside `at`, eg `meta.tags` or `meta["a-b"]`. */
function keyPath(at: string, key: string): string {
  if (!IDENTIFIER.test(key)) {
    return `${at}[${JSON.stringify(key)}]`;
  }

  return at === "" ? key : `${at}.${key}`;
}

/** The key path of `path`, eg `meta.tags[0]` or `meta["a-b"]`. */
function formatPath(path: readonly PathSegment[]): string {
  let at = "";

  for (const segment of path) {
    at = isString(segment) ? keyPath(at, segment) : `${at}[${segment}]`;
  }

  return at;
}

/** Whether a value is written whole, with nothing inside it to check. */
function isWholeValue(value: unknown): value is Date | RegExp | URL {
  return (
    value instanceof Date || value instanceof RegExp || value instanceof URL
  );
}

/**
 * Checks that a value can be written into content, and throws an
 * `UnserializableValueError` naming the key path of the first one that cannot.
 */
function assertContentValue(value: unknown): asserts value is ContentValue {
  assertValueAt(value, [], new WeakSet<object>());
}

// `path` is one stack shared by the whole walk, so key paths are only built when a check throws.
function assertValueAt(
  value: unknown,
  path: PathSegment[],
  parents: WeakSet<object>
): asserts value is ContentValue {
  if (value === undefined || value === null) {
    return;
  }

  if (isSymbol(value)) {
    throw new UnserializableValueError("a symbol", formatPath(path));
  }

  if (isBigInt(value)) {
    throw new UnserializableValueError("a bigint", formatPath(path));
  }

  if (isPrimitive(value)) {
    return;
  }

  const boxed = new Object(value);

  if (isFunction(boxed)) {
    throw new UnserializableValueError("a function", formatPath(path));
  }

  if (parents.has(boxed)) {
    throw new UnserializableValueError(
      "a circular reference",
      formatPath(path)
    );
  }

  if (isWholeValue(value)) {
    return;
  }

  parents.add(boxed);

  try {
    if (boxed instanceof Map) {
      let index = 0;

      for (const [key, entry] of boxed) {
        path.push(index, 0);
        assertValueAt(key, path, parents);
        path[path.length - 1] = 1;
        assertValueAt(entry, path, parents);
        path.length -= 2;
        index += 1;
      }
    } else if (boxed instanceof Set) {
      let index = 0;

      for (const entry of boxed) {
        path.push(index);
        assertValueAt(entry, path, parents);
        path.pop();
        index += 1;
      }
    } else if (Array.isArray(boxed)) {
      // Indexed, not `forEach`: `forEach` skips a sparse array's holes, which are checked as `undefined`.
      for (let index = 0; index < boxed.length; index += 1) {
        path.push(index);
        assertValueAt(boxed[index], path, parents);
        path.pop();
      }
    } else {
      // Its only key is a symbol, so without this it would pass as an empty object.
      if (isFileModule(boxed)) {
        throw new MisplacedModuleError(formatPath(path));
      }

      if (!PLAIN_PROTOTYPES.has(Reflect.getPrototypeOf(boxed))) {
        throw new UnserializableInstanceError(
          boxed.constructor.name,
          formatPath(path)
        );
      }

      for (const [key, entry] of Object.entries(boxed)) {
        path.push(key);
        assertValueAt(entry, path, parents);
        path.pop();
      }
    }
  } finally {
    parents.delete(boxed);
  }
}

export {
  assertContentValue,
  type ContentFields,
  type ContentValue,
  isFields,
  isList,
  isMap,
  isPlainObject,
  isSet,
};
