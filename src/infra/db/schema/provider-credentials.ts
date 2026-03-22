import { pgTable, uuid, varchar, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const providerCredentials = pgTable("provider_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id),
  name: varchar("name", { length: 255 }).notNull().default(""),
  provider: varchar("provider", { length: 64 }).notNull(),
  encryptedSecret: text("encrypted_secret").notNull(),
  metadataJson: jsonb("metadata_json"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
