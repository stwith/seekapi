import { pgTable, uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";

export const providerHealthSnapshots = pgTable("provider_health_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: varchar("provider", { length: 64 }).notNull(),
  capability: varchar("capability", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  latencyMs: integer("latency_ms"),
  checkedAt: timestamp("checked_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
