-- AlterTable
ALTER TABLE "role_requests" ADD COLUMN     "role_metadata" JSONB;

-- CreateTable
CREATE TABLE "commission_configs" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "service_definition_id" TEXT NOT NULL,
    "commission_amount_paise" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commission_configs_role_idx" ON "commission_configs"("role");

-- CreateIndex
CREATE INDEX "commission_configs_is_active_idx" ON "commission_configs"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "commission_configs_role_service_definition_id_key" ON "commission_configs"("role", "service_definition_id");

-- AddForeignKey
ALTER TABLE "commission_configs" ADD CONSTRAINT "commission_configs_service_definition_id_fkey" FOREIGN KEY ("service_definition_id") REFERENCES "service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
