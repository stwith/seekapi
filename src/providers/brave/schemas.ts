/**
 * Brave Search API request and response shapes.
 * These types stay inside the provider adapter and must not leak into canonical contracts.
 */

export interface BraveWebSearchParams {
  q: string;
  count?: number;
  country?: string;
  search_lang?: string;
  freshness?: string;
  result_filter?: string;
}

export interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  page_age?: string;
}

export interface BraveNewsResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

export interface BraveImageResult {
  title: string;
  url: string;
  thumbnail: { src: string };
  source: string;
}

export interface BraveSearchResponse {
  query?: { original: string };
  web?: { results: BraveWebResult[] };
  news?: { results: BraveNewsResult[] };
  images?: { results: BraveImageResult[] };
}
