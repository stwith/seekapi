import { pgTable, uuid, varchar, boolean, integer } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const providerBindings = pgTable("provider_bindings", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  provider: varchar("provider", { length: 64 }).notNull(),
  capability: varchar("capability", { length: 64 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  priority: integer("priority").notNull().default(0),
});
