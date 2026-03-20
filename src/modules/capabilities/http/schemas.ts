import { z } from "zod";

/** Canonical search request body schema (snake_case wire format). [AC3] */
export const searchRequestSchema = z.object({
  query: z.string().min(1),
  max_results: z.number().int().min(1).max(100).optional(),
  country: z.string().optional(),
  locale: z.string().optional(),
  include_domains: z.array(z.string()).optional(),
  exclude_domains: z.array(z.string()).optional(),
  time_range: z.enum(["day", "week", "month", "year"]).optional(),
  provider: z.string().optional(),
  options: z.record(z.unknown()).optional(),
});

export type SearchRequestBody = z.infer<typeof searchRequestSchema>;

/** Canonical search response shape (snake_case wire format). [AC3] */
export const searchResponseSchema = z.object({
  request_id: z.string(),
  provider: z.string(),
  capability: z.string(),
  latency_ms: z.number(),
  items: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
      published_at: z.string().nullable().optional(),
      source_type: z.string(),
      score: z.number().nullable().optional(),
    }),
  ),
  citations: z.array(z.unknown()).optional(),
  extensions: z.record(z.unknown()).optional(),
  raw: z.unknown().optional(),
});
