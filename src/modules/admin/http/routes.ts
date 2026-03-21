/**
 * Admin HTTP routes — project, key, credential, and binding management. [AC3]
 *
 * All admin routes are prefixed with /v1/admin and protected by
 * ADMIN_API_KEY authentication (separate from downstream API keys).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AdminService, AdminError } from "../service/admin-service.js";

/** Parse usage query filters from request query params. [Phase 3.5 AC6] */
function parseUsageFilters(query: Record<string, string>): {
  projectId?: string;
  apiKeyId?: string;
  capability?: string;
  success?: boolean;
  from?: string;
  to?: string;
} {
  const filters: ReturnType<typeof parseUsageFilters> = {};
  if (query.projectId) filters.projectId = query.projectId;
  if (query.apiKeyId) filters.apiKeyId = query.apiKeyId;
  if (query.capability) filters.capability = query.capability;
  if (query.success === "true") filters.success = true;
  else if (query.success === "false") filters.success = false;
  if (query.from) filters.from = query.from;
  if (query.to) filters.to = query.to;
  return filters;
}

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

  // --- List projects [Phase 3 AC4] ---
  app.get(
    "/v1/admin/projects",
    { preHandler: checkAdminAuth },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const projects = await adminService.listProjects();
      return reply.send(projects);
    },
  );

  // --- Get project detail [Phase 3 AC4] ---
  app.get(
    "/v1/admin/projects/:projectId",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      try {
        const detail = await adminService.getProjectDetail(projectId);
        return reply.send(detail);
      } catch (err) {
        if (err instanceof AdminError && err.code === "PROJECT_NOT_FOUND") {
          return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
        }
        throw err;
      }
    },
  );

  // --- List project keys [Phase 3 AC4] ---
  app.get(
    "/v1/admin/projects/:projectId/keys",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      try {
        const keys = await adminService.listProjectKeys(projectId);
        return reply.send(keys);
      } catch (err) {
        if (err instanceof AdminError && err.code === "PROJECT_NOT_FOUND") {
          return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
        }
        throw err;
      }
    },
  );

  // --- List project bindings [Phase 3 AC4] ---
  app.get(
    "/v1/admin/projects/:projectId/bindings",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      try {
        const bindings = await adminService.listProjectBindings(projectId);
        return reply.send(bindings);
      } catch (err) {
        if (err instanceof AdminError && err.code === "PROJECT_NOT_FOUND") {
          return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
        }
        throw err;
      }
    },
  );

  // --- Get credential metadata [Phase 3 AC4] ---
  app.get(
    "/v1/admin/projects/:projectId/credentials",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      try {
        const meta = await adminService.getCredentialMeta(projectId);
        return reply.send(meta);
      } catch (err) {
        if (err instanceof AdminError && err.code === "PROJECT_NOT_FOUND") {
          return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
        }
        throw err;
      }
    },
  );

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
        if (err instanceof AdminError) {
          if (err.code === "PROJECT_NOT_FOUND") {
            return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
          }
          if (err.code === "INVALID_PROVIDER") {
            return reply.status(400).send({ error: "BAD_REQUEST", message: err.message });
          }
        }
        throw err;
      }
    },
  );

  // --- Dashboard stats [Phase 3.5 AC6] ---
  app.get(
    "/v1/admin/stats/dashboard",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = req.query as Record<string, string>;
      const filters = parseUsageFilters(query);
      const stats = await adminService.getDashboardStats(filters);
      return reply.send(stats);
    },
  );

  // --- Time series [Phase 3.5 AC6] ---
  app.get(
    "/v1/admin/stats/timeseries",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = req.query as Record<string, string>;
      const filters = parseUsageFilters(query);
      const granularity = query.granularity === "day" ? "day" : "hour";
      const series = await adminService.getTimeSeries(filters, granularity);
      return reply.send({ series });
    },
  );

  // --- Capability breakdown [Phase 3.5 AC6] ---
  app.get(
    "/v1/admin/stats/capabilities",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = req.query as Record<string, string>;
      const filters = parseUsageFilters(query);
      const capabilities = await adminService.getCapabilityBreakdown(filters);
      return reply.send({ capabilities });
    },
  );

  // --- Usage event query [Phase 3.5 AC6] ---
  app.get(
    "/v1/admin/usage",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = req.query as Record<string, string>;
      const filters = parseUsageFilters(query);
      const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
      const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize ?? "50", 10) || 50));
      const result = await adminService.queryUsageEvents(filters, page, pageSize);
      return reply.send(result);
    },
  );

  // --- Per-key stats [Phase 3.5 AC6] ---
  app.get(
    "/v1/admin/projects/:projectId/keys/stats",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      try {
        const keys = await adminService.getPerKeyStats(projectId);
        return reply.send({ keys });
      } catch (err) {
        if (err instanceof AdminError && err.code === "PROJECT_NOT_FOUND") {
          return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
        }
        throw err;
      }
    },
  );

  // --- Audit log query [Phase 3.5 AC6] ---
  app.get(
    "/v1/admin/audit",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = req.query as Record<string, string>;
      const filters: { projectId?: string; action?: string; from?: string; to?: string } = {};
      if (query.projectId) filters.projectId = query.projectId;
      if (query.action) filters.action = query.action;
      if (query.from) filters.from = query.from;
      if (query.to) filters.to = query.to;
      const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
      const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize ?? "50", 10) || 50));
      const result = await adminService.queryAuditLogs(filters, page, pageSize);
      return reply.send(result);
    },
  );

  // --- Get project quota [Task 38] ---
  app.get(
    "/v1/admin/projects/:projectId/quota",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      try {
        const quota = await adminService.getProjectQuota(projectId);
        return reply.send(quota);
      } catch (err) {
        if (err instanceof AdminError && err.code === "PROJECT_NOT_FOUND") {
          return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
        }
        throw err;
      }
    },
  );

  // --- Update project quota [Task 38] ---
  app.put(
    "/v1/admin/projects/:projectId/quota",
    { preHandler: checkAdminAuth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      const body = req.body as Record<string, unknown> | undefined;

      // Validate numeric fields are non-negative
      const numericFields = ["dailyRequestLimit", "monthlyRequestLimit", "maxKeys", "rateLimitRpm"] as const;
      for (const field of numericFields) {
        const val = body?.[field];
        if (val !== undefined && val !== null && (typeof val !== "number" || val < 0)) {
          return reply.status(400).send({
            error: "BAD_REQUEST",
            message: `${field} must be a non-negative number`,
          });
        }
      }

      // Validate status field
      const VALID_STATUSES = new Set(["active", "suspended"]);
      if (body?.status !== undefined && body.status !== null) {
        if (typeof body.status !== "string" || !VALID_STATUSES.has(body.status)) {
          return reply.status(400).send({
            error: "BAD_REQUEST",
            message: `status must be one of: ${[...VALID_STATUSES].join(", ")}`,
          });
        }
      }

      try {
        const quota = await adminService.upsertProjectQuota(projectId, {
          dailyRequestLimit: body?.dailyRequestLimit !== undefined
            ? (body.dailyRequestLimit as number | null)
            : undefined,
          monthlyRequestLimit: body?.monthlyRequestLimit !== undefined
            ? (body.monthlyRequestLimit as number | null)
            : undefined,
          maxKeys: body?.maxKeys != null ? (body.maxKeys as number) : undefined,
          rateLimitRpm: body?.rateLimitRpm != null ? (body.rateLimitRpm as number) : undefined,
          status: body?.status != null ? (body.status as string) : undefined,
        });
        return reply.send(quota);
      } catch (err) {
        if (err instanceof AdminError && err.code === "PROJECT_NOT_FOUND") {
          return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
        }
        throw err;
      }
    },
  );

  // --- List all quotas [Task 38] ---
  app.get(
    "/v1/admin/quotas",
    { preHandler: checkAdminAuth },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const quotas = await adminService.listAllQuotas();
      return reply.send({ quotas });
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
        if (err instanceof AdminError) {
          if (err.code === "PROJECT_NOT_FOUND") {
            return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
          }
          if (err.code === "INVALID_PROVIDER" || err.code === "INVALID_CAPABILITY") {
            return reply.status(400).send({ error: "BAD_REQUEST", message: err.message });
          }
        }
        throw err;
      }
    },
  );
}
