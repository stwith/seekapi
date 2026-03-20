import type { FastifyInstance } from "fastify";
import type { Capability } from "../../../providers/core/types.js";
import { searchRequestSchema } from "./schemas.js";
import type { SearchService } from "../service/search-service.js";
import { generateRequestId } from "../../../lib/request-id.js";

const ROUTE_CAPABILITY_MAP: Record<string, Capability> = {
  "/v1/search/web": "search.web",
  "/v1/search/news": "search.news",
  "/v1/search/images": "search.images",
};

/**
 * Register canonical search endpoints on the Fastify instance. [AC3][AC4]
 * Each route validates the request, derives the capability from the path,
 * delegates to the search service with the authenticated project context,
 * and returns a normalized response.
 */
export async function registerCapabilityRoutes(
  app: FastifyInstance,
  searchService: SearchService,
): Promise<void> {
  for (const [path, capability] of Object.entries(ROUTE_CAPABILITY_MAP)) {
    app.post(path, async (req, reply) => {
      const requestId = generateRequestId();
      reply.header("x-request-id", requestId);

      const parsed = searchRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "REQUEST_INVALID",
          message: parsed.error.issues.map((i) => i.message).join("; "),
          request_id: requestId,
        });
      }

      const projectId = req.projectContext?.projectId;
      const result = await searchService.execute(
        capability,
        parsed.data,
        requestId,
        projectId,
      );

      return reply.send({
        request_id: result.requestId,
        provider: result.provider,
        capability: result.capability,
        latency_ms: result.latencyMs,
        items: result.items.map((item) => ({
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          published_at: item.publishedAt ?? null,
          source_type: item.sourceType,
          score: item.score ?? null,
        })),
        citations: result.citations ?? [],
        extensions: result.extensions ?? {},
        raw: result.raw ?? null,
      });
    });
  }
}
