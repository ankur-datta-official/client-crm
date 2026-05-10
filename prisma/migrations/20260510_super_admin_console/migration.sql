CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "target_user_id" UUID,
    "organization_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_logs_actor_user_id_created_at_idx" ON "admin_audit_logs"("actor_user_id", "created_at" DESC);
CREATE INDEX "admin_audit_logs_target_user_id_created_at_idx" ON "admin_audit_logs"("target_user_id", "created_at" DESC);
CREATE INDEX "admin_audit_logs_organization_id_created_at_idx" ON "admin_audit_logs"("organization_id", "created_at" DESC);
CREATE INDEX "admin_audit_logs_action_created_at_idx" ON "admin_audit_logs"("action", "created_at" DESC);

ALTER TABLE "admin_audit_logs"
ADD CONSTRAINT "admin_audit_logs_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "profiles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_audit_logs"
ADD CONSTRAINT "admin_audit_logs_target_user_id_fkey"
FOREIGN KEY ("target_user_id") REFERENCES "profiles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_audit_logs"
ADD CONSTRAINT "admin_audit_logs_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
