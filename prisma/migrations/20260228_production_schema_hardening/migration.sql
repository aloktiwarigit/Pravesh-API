-- Production Schema Hardening Migration
-- 1. Add unique constraint to lawyers.bar_council_number (regulatory requirement)
-- 2. Add unique constraint to builders.gst_number (regulatory requirement)
-- 3. Remove duplicate 'verified' column from dealer_bank_accounts (consolidated to is_verified)

-- Step 1: Migrate any 'verified=true' rows to 'is_verified=true' before dropping the column
UPDATE "dealer_bank_accounts"
SET "is_verified" = true
WHERE "verified" = true AND "is_verified" = false;

-- Step 2: Drop the duplicate 'verified' column
ALTER TABLE "dealer_bank_accounts" DROP COLUMN "verified";

-- Step 3: Add unique constraints (will fail if duplicates exist — check data first)
CREATE UNIQUE INDEX "lawyers_bar_council_number_key" ON "lawyers"("bar_council_number");

CREATE UNIQUE INDEX "builders_gst_number_key" ON "builders"("gst_number");
