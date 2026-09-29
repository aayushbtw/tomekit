import { MissingPluginError } from "./errors";
import type { Source } from "./index";
import type { Collections } from "./query";

/**
 * The name of any collection. The types tomekit generates in `.tomekit`
 * narrow it to the names in your config.
 *
 * @example
 * ```ts
 * const name: CollectionName = "posts";
 * ```
 */
type CollectionName = string;

/**
 * A slug in the named collection, or in any collection. The generated types
 * narrow it to the slugs that exist.
 *
 * @example
 * ```ts
 * const slug: SlugOf<"posts"> = "hello-world";
 * ```
 */
// The conditional only uses `TName`, which the generated types need; here every name gives `string`.
type SlugOf<TName extends CollectionName = CollectionName> =
  TName extends unknown ? string : never;

/**
 * A document in the named collection, or in any collection. The generated
 * types give its `metadata` and `body` the types from your config.
 *
 * @example
 * ```ts
 * function title(post: DocumentOf<"posts">) {
 *   return post.metadata.title;
 * }
 * ```
 */
type DocumentOf<TName extends CollectionName = CollectionName> =
  TName extends unknown ? Source : never;

function missingPlugin(): never {
  throw new MissingPluginError("tomekit/content");
}

/**
 * Every collection in your config, for a name only known at runtime, eg a
 * route param. Import a collection by its name otherwise, which bundles only
 * that collection. Provided by the `tomekit()` Vite plugin, or by
 * `tomekit/register` outside Vite; importing it without either throws.
 *
 * @example
 * ```ts
 * import { collections } from "tomekit/content";
 *
 * collections.names(); // ["notes", "posts"]
 * if (collections.has(params.collection)) collections.get(params.collection).slugs();
 * ```
 */
const collections: Collections<Source> = missingPlugin();

export { type CollectionName, collections, type DocumentOf, type SlugOf };
