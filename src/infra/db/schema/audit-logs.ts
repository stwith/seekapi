import { pgTable, uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull(),
  actorType: varchar("actor_type", { length: 32 }).notNull(),
  actorId: varchar("actor_id", { length: 128 }).notNull(),
  action: varchar("action", { length: 128 }).notNull(),
  resourceType: varchar("resource_type", { length: 64 }).notNull(),
  resourceId: varchar("resource_id", { length: 128 }).notNull(),
  detailsJson: jsonb("details_json"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
