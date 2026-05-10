DROP TABLE IF EXISTS "organization_subscriptions" CASCADE;
DROP TABLE IF EXISTS "subscription_plans" CASCADE;

CREATE TABLE "signup_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,
    "notes" TEXT,
    "last_passkey_issued_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signup_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "access_passkeys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "signup_request_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "issued_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "access_passkeys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "signup_requests_email_key" ON "signup_requests"("email");
CREATE INDEX "signup_requests_status_requested_at_idx" ON "signup_requests"("status", "requested_at" DESC);
CREATE INDEX "signup_requests_reviewed_by_idx" ON "signup_requests"("reviewed_by");

CREATE UNIQUE INDEX "access_passkeys_token_hash_key" ON "access_passkeys"("token_hash");
CREATE INDEX "access_passkeys_signup_request_id_created_at_idx" ON "access_passkeys"("signup_request_id", "created_at" DESC);
CREATE INDEX "access_passkeys_email_used_at_expires_at_idx" ON "access_passkeys"("email", "used_at", "expires_at");
CREATE INDEX "access_passkeys_issued_by_idx" ON "access_passkeys"("issued_by");

ALTER TABLE "signup_requests"
ADD CONSTRAINT "signup_requests_reviewed_by_fkey"
FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "access_passkeys"
ADD CONSTRAINT "access_passkeys_signup_request_id_fkey"
FOREIGN KEY ("signup_request_id") REFERENCES "signup_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "access_passkeys"
ADD CONSTRAINT "access_passkeys_issued_by_fkey"
FOREIGN KEY ("issued_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
