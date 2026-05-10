ALTER TABLE "notifications"
  ALTER COLUMN "organization_id" DROP NOT NULL;

ALTER TABLE "notifications"
  ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'workspace',
  ADD COLUMN "payload" JSONB;

UPDATE "notifications"
SET "scope" = 'workspace'
WHERE "scope" IS NULL;

CREATE INDEX "notifications_organization_id_user_id_created_at_idx"
  ON "notifications"("organization_id", "user_id", "created_at" DESC);

CREATE INDEX "notifications_user_id_scope_is_read_created_at_idx"
  ON "notifications"("user_id", "scope", "is_read", "created_at" DESC);
