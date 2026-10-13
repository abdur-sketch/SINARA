CREATE TYPE "DocumentScanStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "employee_documents"
  ADD COLUMN "scan_status" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "scan_note" TEXT,
  ADD COLUMN "reviewed_by_id" UUID,
  ADD COLUMN "reviewed_at" TIMESTAMP(3);

ALTER TABLE "users"
  ADD COLUMN "mfa_secret_encrypted" TEXT,
  ADD COLUMN "mfa_pending_encrypted" TEXT,
  ADD COLUMN "mfa_recovery_hashes" JSONB,
  ADD COLUMN "mfa_failed_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mfa_locked_until" TIMESTAMP(3);

CREATE TABLE "auth_challenges" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rate_limit_buckets" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "window_start" TIMESTAMP(3) NOT NULL,
  "blocked_until" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "auth_challenges_token_hash_key" ON "auth_challenges"("token_hash");
CREATE INDEX "auth_challenges_user_id_expires_at_idx" ON "auth_challenges"("user_id", "expires_at");

ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
