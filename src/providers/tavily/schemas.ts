/**
 * Tavily Search API request and response shapes.
 * These types stay inside the provider adapter and must not leak into canonical contracts.
 */

export interface TavilySearchRequest {
  api_key: string;
  query: string;
  search_depth?: "basic" | "advanced";
  max_results?: number;
  include_answer?: boolean;
  include_domains?: string[];
  exclude_domains?: string[];
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export interface TavilySearchResponse {
  answer?: string;
  results: TavilySearchResult[];
}
