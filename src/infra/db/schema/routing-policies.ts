import { pgTable, uuid, varchar, jsonb, boolean } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const routingPolicies = pgTable("routing_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  capability: varchar("capability", { length: 64 }).notNull(),
  defaultProvider: varchar("default_provider", { length: 64 }).notNull(),
  fallbackOrderJson: jsonb("fallback_order_json"),
  allowExplicitOverride: boolean("allow_explicit_override")
    .notNull()
    .default(true),
});
