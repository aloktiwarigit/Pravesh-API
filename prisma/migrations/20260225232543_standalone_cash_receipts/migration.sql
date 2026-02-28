-- DropForeignKey
ALTER TABLE "cash_receipts" DROP CONSTRAINT "cash_receipts_service_request_id_fkey";

-- AlterTable
ALTER TABLE "cash_receipts" ADD COLUMN     "is_standalone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ALTER COLUMN "task_id" DROP NOT NULL,
ALTER COLUMN "service_request_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "cash_receipts_is_standalone_idx" ON "cash_receipts"("is_standalone");

-- AddForeignKey
ALTER TABLE "cash_receipts" ADD CONSTRAINT "cash_receipts_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
