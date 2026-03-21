import { pgTable, uuid, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const projectQuotas = pgTable("project_quotas", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id),
  dailyRequestLimit: integer("daily_request_limit"), // null = unlimited
  monthlyRequestLimit: integer("monthly_request_limit"), // null = unlimited
  maxKeys: integer("max_keys").notNull().default(10),
  rateLimitRpm: integer("rate_limit_rpm").notNull().default(60),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
