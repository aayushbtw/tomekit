import path from "node:path";

import {
  constructFromEvents,
  CORE_SCHEMA,
  EVENT_ID,
  getScalarValue,
  parseEvents,
  SCALAR_STYLE,
  YAMLException,
} from "js-yaml";
import type { Event } from "js-yaml";

import type { Issue } from "./errors";
import type { Entry, FileInfo } from "./index";
import { isString } from "./kind";
import { isPlainObject } from "./value";

const FRONTMATTER = /^---\r?\n(?:(?<data>[\s\S]*?)\r?\n)?---(?:\r?\n|$)/u;

const EXTENSION = /\.[^./]+$/u;

/** Where a key is written in a file. `line` and `column` start at 1. */
interface Position {
  column: number;
  line: number;
}

/** Where a key of an entry's metadata is written, as deep as the key path exists. */
type Locate = (keys: readonly string[]) => Position | undefined;

// A symbol key keeps the locator off the public `Entry` and out of the entry's hash. From the registry,
// because the config imports `directory()` through Vite's module runner, a different copy of this module.
const LOCATE = Symbol.for("tomekit.locate");

interface LocatedEntry extends Entry<FileInfo> {
  readonly [LOCATE]: Locate;
}

function isLocated(entry: Entry): entry is LocatedEntry {
  return LOCATE in entry;
}

interface ParseInput {
  /** Relative to the collection directory, eg `guides/setup.md`. */
  file: string;
  /** Relative to the project root. */
  filePath: string;
  /** The file's full text, frontmatter included. */
  text: string;
}

/** The file's entry, unless its YAML does not parse, and what is wrong with it. An entry with issues is still validated, so every problem shows, but left out. */
interface ParseResult {
  entry: LocatedEntry | undefined;
  issues: Issue[];
}

function position(text: string, offset: number): Position {
  const before = text.slice(0, offset);

  return {
    column: offset - before.lastIndexOf("\n"),
    line: before.split("\n").length,
  };
}

function isSlug(value: unknown): value is string {
  return isString(value) && value !== "";
}

function isCollection(event: Event | undefined): boolean {
  return event?.type === EVENT_ID.MAPPING || event?.type === EVENT_ID.SEQUENCE;
}

/** The index just past the node whose event is at `index`, children included. */
function skipNode(events: readonly Event[], index: number): number {
  let depth = 0;
  let next = index;

  do {
    const event = events[next];

    if (isCollection(event)) {
      depth += 1;
    } else if (event?.type === EVENT_ID.POP) {
      depth -= 1;
    }

    next += 1;
  } while (depth > 0 && next < events.length);

  return next;
}

/** Where the node whose event is at `index` starts, quotes included. */
function startOf(events: readonly Event[], index: number): number | undefined {
  const event = events[index];

  switch (event?.type) {
    case EVENT_ID.MAPPING:
    case EVENT_ID.SEQUENCE: {
      return event.start;
    }

    case EVENT_ID.SCALAR: {
      const quoted =
        event.style === SCALAR_STYLE.SINGLE_QUOTED ||
        event.style === SCALAR_STYLE.DOUBLE_QUOTED;

      return quoted ? event.valueStart - 1 : event.valueStart;
    }

    case EVENT_ID.ALIAS: {
      // `anchorStart` is after the `*`.
      return event.anchorStart - 1;
    }

    case undefined:
    case EVENT_ID.DOCUMENT:
    case EVENT_ID.POP:
    default: {
      return undefined;
    }
  }
}

/** The index of the value for `key` in the mapping whose event is at `index`, and of its key. */
function pairOf(
  events: readonly Event[],
  source: string,
  index: number,
  key: string
): { key: number; value: number } | undefined {
  let next = index + 1;

  while (next < events.length && events[next]?.type !== EVENT_ID.POP) {
    const event = events[next];
    const value = skipNode(events, next);

    if (
      event?.type === EVENT_ID.SCALAR &&
      getScalarValue(source, event) === key
    ) {
      return { key: next, value };
    }

    next = skipNode(events, value);
  }

  return undefined;
}

/** The index of item `key` in the sequence whose event is at `index`. */
function itemOf(
  events: readonly Event[],
  index: number,
  key: string
): number | undefined {
  const target = Number(key);
  let next = index + 1;

  for (let item = 0; next < events.length; item += 1) {
    if (events[next]?.type === EVENT_ID.POP) {
      return undefined;
    }

    if (item === target) {
      return next;
    }

    next = skipNode(events, next);
  }

  return undefined;
}

/** The offset of the key or item at `keys`, as deep as the frontmatter goes. */
function offsetOf(
  events: readonly Event[],
  source: string,
  keys: readonly string[]
): number | undefined {
  // The first event opens the document; its content is the next one.
  let index = 1;
  let offset = startOf(events, index);

  for (const key of keys) {
    const type = events[index]?.type;

    if (type === EVENT_ID.MAPPING) {
      const pair = pairOf(events, source, index, key);

      if (pair === undefined) {
        break;
      }

      offset = startOf(events, pair.key);
      index = pair.value;
    } else if (type === EVENT_ID.SEQUENCE) {
      const item = itemOf(events, index, key);

      if (item === undefined) {
        break;
      }

      offset = startOf(events, item);
      index = item;
    } else {
      break;
    }
  }

  return offset;
}

/** The frontmatter's value and the events its positions are read from, or the first problem in it. */
function readYaml(
  source: string
):
  | { events: Event[]; issue?: undefined; value: unknown }
  | { issue: { message: string; offset: number | undefined } } {
  let events: Event[];
  let documents: unknown[];

  try {
    events = parseEvents(source, {});
    documents = constructFromEvents(events, { schema: CORE_SCHEMA, source });
  } catch (error) {
    if (error instanceof YAMLException) {
      return {
        issue: { message: error.reason, offset: error.mark?.position },
      };
    }

    throw error;
  }

  if (documents.length > 1) {
    return {
      issue: {
        message:
          "frontmatter must be one YAML document. Remove the `...` or `---` inside it",
        offset: undefined,
      },
    };
  }

  return { events, value: documents[0] };
}

/** Splits a Markdown file into an entry: frontmatter as metadata, the rest as body. Reads nothing from disk. */
function parse({ file, filePath, text: raw }: ParseInput): ParseResult {
  // Editors that save a byte order mark put it before the opening `---`, which would hide the frontmatter.
  const text = raw.startsWith("﻿") ? raw.slice(1) : raw;
  const match = FRONTMATTER.exec(text);
  const frontmatter = match?.groups?.data;

  const yaml = frontmatter === undefined ? undefined : readYaml(frontmatter);

  /** Where an offset into the YAML is. With no offset it is the opening `---`. */
  function positionAt(offset: number | undefined): Position {
    if (offset === undefined) {
      return { column: 1, line: 1 };
    }

    const start = (match?.[0].indexOf("\n") ?? -1) + 1;

    return position(text, start + offset);
  }

  if (yaml?.issue !== undefined) {
    const { message, offset } = yaml.issue;

    return { entry: undefined, issues: [{ ...positionAt(offset), message }] };
  }

  const events = yaml?.events;
  // Not checked here: YAML's core schema yields only plain data, and `loadCollection` checks every entry.
  const metadata: unknown = yaml?.value ?? {};

  const slug =
    isPlainObject(metadata) && "slug" in metadata ? metadata.slug : undefined;

  function locate(keys: readonly string[]): Position | undefined {
    if (match === null) {
      return undefined;
    }

    return positionAt(
      events === undefined || frontmatter === undefined
        ? undefined
        : offsetOf(events, frontmatter, keys)
    );
  }

  const frontmatterIssues = isPlainObject(metadata)
    ? []
    : [
        {
          ...locate([]),
          message: `frontmatter must be keys and values, eg "title: Hello", not ${Array.isArray(metadata) ? "a list" : "a single value"}`,
        },
      ];

  const slugIssues =
    slug === undefined || isSlug(slug)
      ? []
      : [
          {
            ...locate(["slug"]),
            message:
              'slug: must be a non-empty string, eg "hello-world". Remove it to use the file path instead',
          },
        ];

  return {
    issues: [...frontmatterIssues, ...slugIssues],
    entry: {
      body: match ? text.slice(match[0].length) : text,
      file: { path: filePath },
      [LOCATE]: locate,
      metadata: isPlainObject(metadata) ? metadata : {},
      slug: isSlug(slug)
        ? slug
        : file.split(path.sep).join("/").replace(EXTENSION, ""),
    },
  };
}

export {
  isLocated,
  type Locate,
  LOCATE,
  type LocatedEntry,
  parse,
  type ParseResult,
  type Position,
};
