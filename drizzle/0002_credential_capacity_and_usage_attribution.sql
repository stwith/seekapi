-- Add credential_id column to usage_events for per-credential attribution.
-- Nullable for backward compatibility with existing rows.
ALTER TABLE "usage_events"
  ADD COLUMN "credential_id" uuid;
--> statement-breakpoint
-- Create credential_capacities table for per-credential capacity policies.
CREATE TABLE IF NOT EXISTS "credential_capacities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "credential_id" uuid NOT NULL REFERENCES "provider_credentials"("id") UNIQUE,
  "daily_limit" integer,
  "monthly_limit" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
