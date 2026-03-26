import {
  pgTable,
  uuid,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { providerCredentials } from "./provider-credentials.js";

export const credentialCapacities = pgTable("credential_capacities", {
  id: uuid("id").defaultRandom().primaryKey(),
  credentialId: uuid("credential_id")
    .notNull()
    .references(() => providerCredentials.id)
    .unique(),
  dailyLimit: integer("daily_limit"),
  monthlyLimit: integer("monthly_limit"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
