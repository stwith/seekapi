import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "../service/auth-service.js";
import type { RateLimitService } from "../service/rate-limit-service.js";
import type { ProjectContext } from "../../projects/service/project-service.js";

/** Paths that bypass API key authentication. */
const PUBLIC_PATHS = new Set(["/v1/health", "/v1/health/providers"]);

/** Extend Fastify request to carry the resolved project context. */
declare module "fastify" {
  interface FastifyRequest {
    projectContext?: ProjectContext;
  }
}

export interface AuthPreHandlerDeps {
  rateLimitService?: RateLimitService;
}

/**
 * Register a global preHandler hook that enforces Bearer token auth
 * on all routes except those listed in PUBLIC_PATHS. [AC2]
 */
export async function registerAuthPreHandler(
  app: FastifyInstance,
  deps?: AuthPreHandlerDeps,
): Promise<void> {
  const authService = new AuthService();

  app.addHook(
    "preHandler",
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (PUBLIC_PATHS.has(req.routeOptions.url ?? req.url)) return;

      const header = req.headers.authorization;
      if (!header || !header.toLowerCase().startsWith("bearer ")) {
        return reply.status(401).send({
          error: "UNAUTHORIZED",
          message: "Missing or malformed Authorization header",
        });
      }

      const token = header.slice("bearer ".length);
      const project = authService.authenticate(token);
      if (!project) {
        return reply.status(401).send({
          error: "UNAUTHORIZED",
          message: "Invalid API key",
        });
      }

      // Rate limiting — check after auth so we know the project.
      // If the rate-limit backend (Redis) is unreachable, allow the request
      // through rather than turning every call into a 500.
      if (deps?.rateLimitService) {
        try {
          const limit = await deps.rateLimitService.check(project.projectId);
          reply.header("x-ratelimit-limit", String(limit.limit));
          reply.header("x-ratelimit-remaining", String(limit.remaining));
          reply.header("x-ratelimit-reset", String(limit.resetSeconds));

          if (!limit.allowed) {
            return reply.status(429).send({
              error: "RATE_LIMITED",
              message: "Project rate limit exceeded",
            });
          }
        } catch {
          // Redis down — degrade gracefully, let request proceed without limits
          req.log.warn("rate-limit check failed, allowing request");
        }
      }

      req.projectContext = project;
    },
  );
}
