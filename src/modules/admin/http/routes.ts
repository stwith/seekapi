/**
 * Admin HTTP routes — project, key, credential, and binding management. [AC3]
 *
 * All admin routes are prefixed with /v1/admin and protected by
 * ADMIN_API_KEY authentication (separate from downstream API keys).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AdminService, AdminError } from "../service/admin-service.js";

export interface AdminRouteDeps {
  adminService: AdminService;
  /** The expected ADMIN_API_KEY value for admin authentication. */
  adminApiKey: string;
}

/**
 * Register admin endpoints under /v1/admin/*.
 *
 * Admin auth uses a simple Bearer token check against ADMIN_API_KEY.
 * This is separate from the downstream API key auth system. [AC3]
 */
export async function registerAdminRoutes(
  app: FastifyInstance,
  deps: AdminRouteDeps,
): Promise<void> {
  const { adminService, adminApiKey } = deps;

  // Admin auth hook — only applies to /v1/admin/* routes
  async function checkAdminAuth(req: FastifyRequest, reply: FastifyReply) {
    const header = req.headers.authorization;
    if (!header || !header.toLowerCase().startsWith("bearer ")) {
      return reply.status(401).send({
        error: "UNAUTHORIZED",
        message: "Missing or malformed Authorization header",
      });
    }
    const token = header.slice("bearer ".length);
    if (token !== adminApiKey) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Invalid admin API key",
      });
    }
  }

  // --- Create project ---
  app.post(
    "/v1/admin/projects",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as { name?: string } | undefined;
      if (!body?.name || typeof body.name !== "string") {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "name is required",
        });
      }

      const project = await adminService.createProject(body.name);
      return reply.status(201).send(project);
    },
  );

  // --- Create API key ---
  app.post(
    "/v1/admin/projects/:projectId/keys",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      try {
        const result = await adminService.createApiKey(projectId);
        return reply.status(201).send(result);
      } catch (err) {
        if (err instanceof AdminError && err.code === "PROJECT_NOT_FOUND") {
          return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
        }
        throw err;
      }
    },
  );

  // --- Disable API key ---
  app.post(
    "/v1/admin/keys/:keyId/disable",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { keyId } = req.params as { keyId: string };
      await adminService.disableApiKey(keyId);
      return reply.status(200).send({ status: "disabled" });
    },
  );

  // --- Attach / rotate credential ---
  app.post(
    "/v1/admin/projects/:projectId/credentials",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      const body = req.body as { provider?: string; secret?: string } | undefined;
      if (!body?.provider || !body?.secret) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "provider and secret are required",
        });
      }

      try {
        const result = await adminService.upsertCredential(
          projectId,
          body.provider,
          body.secret,
        );
        return reply.status(201).send(result);
      } catch (err) {
        if (err instanceof AdminError && err.code === "PROJECT_NOT_FOUND") {
          return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
        }
        throw err;
      }
    },
  );

  // --- Configure binding ---
  app.post(
    "/v1/admin/projects/:projectId/bindings",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      const body = req.body as {
        provider?: string;
        capability?: string;
        enabled?: boolean;
        priority?: number;
      } | undefined;

      if (!body?.provider || !body?.capability) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "provider and capability are required",
        });
      }

      try {
        await adminService.configureBinding(projectId, {
          provider: body.provider,
          capability: body.capability,
          enabled: body.enabled ?? true,
          priority: body.priority ?? 0,
        });
        return reply.status(200).send({ status: "configured" });
      } catch (err) {
        if (err instanceof AdminError && err.code === "PROJECT_NOT_FOUND") {
          return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
        }
        throw err;
      }
    },
  );
}
