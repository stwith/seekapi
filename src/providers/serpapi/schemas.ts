/**
 * SerpAPI request and response shapes.
 * These types stay inside the provider adapter and must not leak into canonical contracts.
 */

export interface SerpApiSearchParams {
  q: string;
  engine?: string;
  num?: number;
  tbm?: string;
}

/** Organic web result from SerpAPI. */
export interface SerpApiOrganicResult {
  title: string;
  link: string;
  snippet?: string;
  date?: string;
  position?: number;
  thumbnail?: string;
}

/** News result from SerpAPI (tbm=nws). */
export interface SerpApiNewsResult {
  title: string;
  link: string;
  snippet?: string;
  date?: string;
  source?: string;
  thumbnail?: string;
}

/** Image result from SerpAPI (tbm=isch). */
export interface SerpApiImageResult {
  title: string;
  link: string;
  original: string;
  thumbnail: string;
  source?: string;
}

export interface SerpApiSearchMetadata {
  id: string;
  status: string;
  json_endpoint?: string;
  created_at?: string;
  processed_at?: string;
  total_time_taken?: number;
}

export interface SerpApiSearchResponse {
  search_metadata: SerpApiSearchMetadata;
  organic_results?: SerpApiOrganicResult[];
  news_results?: SerpApiNewsResult[];
  images_results?: SerpApiImageResult[];
  error?: string;
}
