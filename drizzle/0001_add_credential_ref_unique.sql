-- Add unique constraint on (project_id, credential_id) to prevent duplicate refs.
-- Clean up any pre-existing duplicates first.
DELETE FROM "project_credential_refs" a
  USING "project_credential_refs" b
  WHERE a.id > b.id
    AND a.project_id = b.project_id
    AND a.credential_id = b.credential_id;
--> statement-breakpoint
ALTER TABLE "project_credential_refs"
  ADD CONSTRAINT "uq_project_credential" UNIQUE ("project_id", "credential_id");
