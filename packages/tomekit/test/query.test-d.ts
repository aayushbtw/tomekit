// Checked by `pnpm check`, never run: each line fails to compile if inference breaks.
import type { Collection } from "../src/index";

// A known slug returns its document; any other string may not exist until `has` says so.
declare const known: Collection<{ title: string }, "a" | "b", "a" | "b">;

declare const fromRoute: string;

export const knownTitle: string = known.get("a").title;

export const routeTitle: string | undefined = known.get(fromRoute)?.title;

// @ts-expect-error a slug from a plain string may not exist
export const uncheckedTitle: string = known.get(fromRoute).title;

// A template literal is built at runtime, so it may not exist.
export const builtTitle: string | undefined = known.get(
  `${fromRoute}/a`
)?.title;

// @ts-expect-error a slug literal that is not a known slug is a typo
export const typoTitle = known.get("c");

export const checkedTitle: string = known.has(fromRoute)
  ? known.get(fromRoute).title
  : "";

// A generic helper takes any collection whose documents fit.
export function titles<TDocument extends { title: string }>(
  collection: Collection<TDocument>
): string[] {
  return collection.documents().map((document) => document.title);
}

// Without known slugs, any literal may exist.
export function hasHome<TDocument>(collection: Collection<TDocument>): boolean {
  return collection.get("home") !== undefined;
}

export const knownTitles: string[] = titles(known);
