/**
 * Kagi Search API request and response shapes.
 * These types stay inside the provider adapter and must not leak into canonical contracts.
 */

export interface KagiSearchParams {
  q: string;
  limit?: number;
}

/** t=0 search result object */
export interface KagiSearchResult {
  t: number;
  url: string;
  title: string;
  snippet?: string;
  published?: string;
  thumbnail?: { url: string; width?: number; height?: number };
}

export interface KagiSearchMeta {
  id: string;
  node: string;
  ms: number;
  api_balance?: number;
}

export interface KagiErrorObject {
  code: number;
  msg: string;
  ref?: string;
}

export interface KagiSearchResponse {
  meta: KagiSearchMeta;
  data: KagiSearchResult[] | null;
  error?: KagiErrorObject[];
}
