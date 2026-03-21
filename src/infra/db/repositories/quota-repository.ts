/**
 * Repository for project quota configuration. [Task 38]
 *
 * Provides both an in-memory implementation (tests) and a
 * Drizzle-backed implementation (production).
 */

import { eq } from "drizzle-orm";
import type { DbClient } from "../client.js";
import { projectQuotas } from "../schema/project-quotas.js";

export interface ProjectQuota {
  id: string;
  projectId: string;
  dailyRequestLimit: number | null;
  monthlyRequestLimit: number | null;
  maxKeys: number;
  rateLimitRpm: number;
  status: string;
}

export interface QuotaRepository {
  findByProjectId(projectId: string): Promise<ProjectQuota | undefined>;
  upsert(quota: ProjectQuota): Promise<void>;
  listAll(): Promise<ProjectQuota[]>;
}

/**
 * In-memory implementation for tests and local development.
 */
export class InMemoryQuotaRepository implements QuotaRepository {
  private readonly quotas = new Map<string, ProjectQuota>();

  async findByProjectId(projectId: string): Promise<ProjectQuota | undefined> {
    return this.quotas.get(projectId);
  }

  async upsert(quota: ProjectQuota): Promise<void> {
    this.quotas.set(quota.projectId, { ...quota });
  }

  async listAll(): Promise<ProjectQuota[]> {
    return [...this.quotas.values()];
  }
}

/**
 * Drizzle-backed implementation for production persistence.
 */
export class DrizzleQuotaRepository implements QuotaRepository {
  constructor(private readonly db: DbClient) {}

  async findByProjectId(projectId: string): Promise<ProjectQuota | undefined> {
    const rows = await this.db
      .select({
        id: projectQuotas.id,
        projectId: projectQuotas.projectId,
        dailyRequestLimit: projectQuotas.dailyRequestLimit,
        monthlyRequestLimit: projectQuotas.monthlyRequestLimit,
        maxKeys: projectQuotas.maxKeys,
        rateLimitRpm: projectQuotas.rateLimitRpm,
        status: projectQuotas.status,
      })
      .from(projectQuotas)
      .where(eq(projectQuotas.projectId, projectId))
      .limit(1);
    return rows[0];
  }

  async upsert(quota: ProjectQuota): Promise<void> {
    const existing = await this.findByProjectId(quota.projectId);
    if (existing) {
      await this.db
        .update(projectQuotas)
        .set({
          dailyRequestLimit: quota.dailyRequestLimit,
          monthlyRequestLimit: quota.monthlyRequestLimit,
          maxKeys: quota.maxKeys,
          rateLimitRpm: quota.rateLimitRpm,
          status: quota.status,
          updatedAt: new Date(),
        })
        .where(eq(projectQuotas.projectId, quota.projectId));
    } else {
      await this.db.insert(projectQuotas).values({
        id: quota.id,
        projectId: quota.projectId,
        dailyRequestLimit: quota.dailyRequestLimit,
        monthlyRequestLimit: quota.monthlyRequestLimit,
        maxKeys: quota.maxKeys,
        rateLimitRpm: quota.rateLimitRpm,
        status: quota.status,
      });
    }
  }

  async listAll(): Promise<ProjectQuota[]> {
    return this.db
      .select({
        id: projectQuotas.id,
        projectId: projectQuotas.projectId,
        dailyRequestLimit: projectQuotas.dailyRequestLimit,
        monthlyRequestLimit: projectQuotas.monthlyRequestLimit,
        maxKeys: projectQuotas.maxKeys,
        rateLimitRpm: projectQuotas.rateLimitRpm,
        status: projectQuotas.status,
      })
      .from(projectQuotas);
  }
}
