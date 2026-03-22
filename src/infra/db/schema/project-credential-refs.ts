import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { providerCredentials } from "./provider-credentials.js";

export const projectCredentialRefs = pgTable("project_credential_refs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  credentialId: uuid("credential_id").notNull().references(() => providerCredentials.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
