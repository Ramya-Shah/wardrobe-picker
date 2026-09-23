import type { ClothingItem } from "@/lib/types";

/**
 * Semantic search extension point.
 *
 * V1 ships without embeddings or any AI service. A future provider (local embedding
 * model, sqlite-vec, an optional API…) only has to implement this interface and be
 * returned from `getSemanticSearchProvider()`; `lib/search/search.ts` will then blend its
 * scores with structured search automatically. Each item's `searchText` is the text to embed.
 */
export interface SemanticSearchProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  /** Return a similarity in [0, 1] for each candidate id (missing ids = no semantic match). */
  score(query: string, candidates: ClothingItem[]): Promise<Map<string, number>>;
}

export class DisabledSemanticSearch implements SemanticSearchProvider {
  readonly name = "disabled";
  async isAvailable() {
    return false;
  }
  async score() {
    return new Map<string, number>();
  }
}

let provider: SemanticSearchProvider = new DisabledSemanticSearch();

export function getSemanticSearchProvider(): SemanticSearchProvider {
  return provider;
}

/** For tests or a future settings toggle. */
export function setSemanticSearchProvider(next: SemanticSearchProvider) {
  provider = next;
}
