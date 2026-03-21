import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  name: varchar("name", { length: 255 }).notNull(),
  hashedKey: varchar("hashed_key", { length: 128 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
