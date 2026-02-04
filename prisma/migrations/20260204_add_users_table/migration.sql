-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING_ROLE', 'PENDING_APPROVAL', 'SUSPENDED', 'DEACTIVATED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "display_name" TEXT,
    "email" TEXT,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primary_role" TEXT,
    "city_id" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_ROLE',
    "is_nri" BOOLEAN NOT NULL DEFAULT false,
    "country_code" TEXT,
    "language_pref" TEXT NOT NULL DEFAULT 'hi',
    "profile_data" JSONB,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_city_id_idx" ON "users"("city_id");

-- CreateIndex
CREATE INDEX "users_roles_idx" ON "users" USING GIN ("roles");
