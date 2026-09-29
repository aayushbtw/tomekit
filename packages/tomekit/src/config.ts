import type { Config, Loader } from "./index";
import { isPlainObject } from "./value";

const COLLECTION_NAME = /^[A-Za-z][\dA-Za-z_]*$/u;

/** Words a collection can't be named, since each collection is exported under its name: reserved words, and the `collections` export. */
const TAKEN_NAMES = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "collections",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

function nameIssue(name: string): string | undefined {
  if (!COLLECTION_NAME.test(name)) {
    return `collection ${JSON.stringify(name)} has an invalid name. Use letters, digits and "_", starting with a letter, eg "blogPosts".`;
  }

  if (TAKEN_NAMES.has(name)) {
    return `collection ${JSON.stringify(name)} can't be imported under that name${name === "collections" ? ", which the list of every collection uses" : ", which JavaScript reserves"}. Rename it, eg "${name}Items".`;
  }

  return undefined;
}

// A JavaScript config, or one written before loaders, can leave `loader` out.
function isLoader(value: unknown): value is Loader {
  return (
    isPlainObject(value) && "load" in value && value.load instanceof Function
  );
}

function isKeyPath(path: string): boolean {
  return path.split(".").every((key) => key !== "");
}

/** Problems with `references`, which TypeScript checks too, for a JavaScript config or a cast. */
function referenceIssues(config: Config): string[] {
  const references: unknown = config.references;

  if (references === undefined) {
    return [];
  }

  if (!isPlainObject(references)) {
    return [
      'references must be an object keyed by collection name, eg `references: { posts: { author: "authors" } }`.',
    ];
  }

  const names = Object.keys(config.collections);
  const choices = names.map((name) => JSON.stringify(name)).join(", ");

  return Object.entries(references).flatMap(([name, paths]) => {
    const at = `references.${name}`;

    if (!names.includes(name)) {
      return [
        `${at}: there is no collection ${JSON.stringify(name)}. Use one of ${choices}.`,
      ];
    }

    if (!isPlainObject(paths)) {
      return [
        `${at} must be an object from key path to collection name, eg \`{ author: "authors" }\`.`,
      ];
    }

    return Object.entries(paths).flatMap(([path, target]) => {
      const key = `${at}[${JSON.stringify(path)}]`;

      if (!isKeyPath(path)) {
        return [
          `${key} is not a key path. Separate keys with ".", eg "sections.author".`,
        ];
      }

      return new Object(target) instanceof String &&
        names.includes(String(target))
        ? []
        : [
            `${key} must name a collection, got ${JSON.stringify(target)}. Use one of ${choices}.`,
          ];
    });
  });
}

/** Problems that stop a config from loading, one message each. Empty when it is valid. */
function configIssues(config: Config): string[] {
  return [
    ...Object.entries(config.collections).flatMap(([name, collection]) => [
      ...[nameIssue(name)].filter((issue) => issue !== undefined),
      ...(isLoader(collection.loader)
        ? []
        : [
            `collection ${JSON.stringify(name)} has no loader. Set one, eg \`loader: directory("content/${name}")\`.`,
          ]),
    ]),
    ...referenceIssues(config),
  ];
}

export { configIssues };
