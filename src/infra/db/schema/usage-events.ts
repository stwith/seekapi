import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: varchar("request_id", { length: 64 }).notNull(),
  projectId: uuid("project_id").notNull(),
  apiKeyId: uuid("api_key_id").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  capability: varchar("capability", { length: 64 }).notNull(),
  statusCode: integer("status_code").notNull(),
  success: boolean("success").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  resultCount: integer("result_count").notNull().default(0),
  fallbackCount: integer("fallback_count").notNull().default(0),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
