import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "../service/auth-service.js";
import type { ProjectContext } from "../../projects/service/project-service.js";

/** Paths that bypass API key authentication. */
const PUBLIC_PATHS = new Set(["/v1/health"]);

/** Extend Fastify request to carry the resolved project context. */
declare module "fastify" {
  interface FastifyRequest {
    projectContext?: ProjectContext;
  }
}

/**
 * Register a global preHandler hook that enforces Bearer token auth
 * on all routes except those listed in PUBLIC_PATHS. [AC2]
 */
export async function registerAuthPreHandler(
  app: FastifyInstance,
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

      req.projectContext = project;
    },
  );
}
