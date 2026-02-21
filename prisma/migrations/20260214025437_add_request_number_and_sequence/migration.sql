/*
  Warnings:

  - Added the required column `account_number` to the `dealer_bank_accounts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RoleRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('SERVICE_CANCELLED', 'DUPLICATE_PAYMENT', 'SERVICE_NOT_DELIVERED', 'CUSTOMER_DISSATISFACTION', 'OVERCHARGE', 'OTHER');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('PAYMENT_ISSUE', 'SERVICE_DELAY', 'DOCUMENT_ISSUE', 'REFUND_REQUEST', 'GENERAL_INQUIRY', 'COMPLAINT', 'TECHNICAL_ISSUE', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "dealer_bank_accounts" ADD COLUMN     "account_number" TEXT NOT NULL,
ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "razorpay_contact_id" TEXT,
ADD COLUMN     "razorpay_fund_account_id" TEXT;

-- AlterTable
ALTER TABLE "lawyer_bank_accounts" ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "razorpay_contact_id" TEXT,
ADD COLUMN     "razorpay_fund_account_id" TEXT;

-- AlterTable
ALTER TABLE "service_instances" ADD COLUMN     "property_address" TEXT,
ADD COLUMN     "property_city" TEXT,
ADD COLUMN     "property_locality" TEXT,
ADD COLUMN     "property_type" TEXT,
ADD COLUMN     "property_value_paise" BIGINT;

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "service_instance_id" TEXT NOT NULL,
    "service_code" TEXT,
    "customer_id" TEXT NOT NULL,
    "assigned_agent_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payment_method" TEXT,
    "payment_status" TEXT,
    "request_number" TEXT,
    "cash_receipt_id" TEXT,
    "city_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_assignment_logs" (
    "id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "assigned_agent_id" TEXT NOT NULL,
    "previous_agent_id" TEXT,
    "assigned_by" TEXT NOT NULL,
    "assignment_method" TEXT NOT NULL,
    "scoring_snapshot" JSONB,
    "reason" TEXT,
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_assignment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklists" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "service_request_id" TEXT,
    "service_code" TEXT NOT NULL,
    "total_steps" INTEGER NOT NULL,
    "completed_steps" INTEGER NOT NULL DEFAULT 0,
    "template_snapshot" JSONB NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_progress" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "title_hi" TEXT NOT NULL,
    "requires_photo" BOOLEAN NOT NULL DEFAULT false,
    "requires_gps" BOOLEAN NOT NULL DEFAULT false,
    "requires_document" BOOLEAN NOT NULL DEFAULT false,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "gps_lat" DOUBLE PRECISION,
    "gps_lng" DOUBLE PRECISION,
    "photo_urls" TEXT[],
    "document_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL,
    "client_timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_receipts" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "amount_paise" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "gps_lat" DOUBLE PRECISION NOT NULL,
    "gps_lng" DOUBLE PRECISION NOT NULL,
    "signature_hash" TEXT NOT NULL,
    "pdf_url" TEXT,
    "city_id" TEXT NOT NULL,
    "client_timestamp" TIMESTAMP(3) NOT NULL,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "deposit_id" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_deposits" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "amount_paise" TEXT NOT NULL,
    "receipt_count" INTEGER NOT NULL,
    "deposit_method" TEXT NOT NULL,
    "deposit_reference" TEXT,
    "deposit_photo_url" TEXT,
    "gps_lat" DOUBLE PRECISION NOT NULL,
    "gps_lng" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_verification',
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "notes" TEXT,
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_reconciliation_logs" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "reconciliation_date" TIMESTAMP(3) NOT NULL,
    "total_payments_paise" INTEGER NOT NULL,
    "total_cash_receipts_paise" INTEGER NOT NULL,
    "discrepancy_paise" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "payment_count" INTEGER NOT NULL,
    "receipt_count" INTEGER NOT NULL,
    "reconciled_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_reconciliation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_slabs" (
    "id" TEXT NOT NULL,
    "service_definition_id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "slab_name" TEXT NOT NULL,
    "property_value_min_paise" BIGINT NOT NULL,
    "property_value_max_paise" BIGINT NOT NULL,
    "service_fee_paise" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_calculations" (
    "id" TEXT NOT NULL,
    "service_definition_id" TEXT NOT NULL,
    "property_value_paise" BIGINT NOT NULL,
    "city_id" TEXT NOT NULL,
    "slab_id" TEXT,
    "result_fee_paise" INTEGER NOT NULL,
    "is_base_fee" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_ratings" (
    "id" TEXT NOT NULL,
    "service_instance_id" TEXT NOT NULL,
    "service_request_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "rating" INTEGER NOT NULL,
    "review_text" VARCHAR(1000),
    "review_text_hi" VARCHAR(1000),
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_referrals" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "referral_code" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "referral_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_configs" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "credit_amount_paise" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_referral_credits" (
    "id" TEXT NOT NULL,
    "referrer_customer_id" TEXT NOT NULL,
    "referred_customer_id" TEXT NOT NULL,
    "service_request_id" TEXT,
    "credit_amount_paise" INTEGER NOT NULL,
    "used_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_referral_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_variances" (
    "id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "estimated_govt_fee_paise" INTEGER NOT NULL,
    "actual_govt_fee_paise" INTEGER NOT NULL,
    "variance_paise" INTEGER NOT NULL,
    "variance_reason_en" TEXT NOT NULL,
    "variance_reason_hi" TEXT NOT NULL,
    "reported_by_ops_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adjusted_amount_paise" INTEGER,
    "resolution_notes" TEXT,
    "resolved_by_ops_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "evidence_urls" TEXT[],
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_variances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "requested_role" TEXT NOT NULL,
    "status" "RoleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "reason" "RefundReason" NOT NULL,
    "reason_text" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "razorpay_refund_id" TEXT,
    "processed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "initiated_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "service_id" TEXT,
    "category" "TicketCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assigned_to" TEXT,
    "city_id" TEXT NOT NULL,
    "sla_deadline" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "whatsapp_thread_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_role" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franchise_territories" (
    "id" TEXT NOT NULL,
    "franchise_id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "is_exclusive" BOOLEAN NOT NULL DEFAULT true,
    "revenue_share_bps" INTEGER NOT NULL DEFAULT 1000,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchise_territories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_request_number_key" ON "service_requests"("request_number");

-- CreateIndex
CREATE INDEX "service_requests_service_instance_id_idx" ON "service_requests"("service_instance_id");

-- CreateIndex
CREATE INDEX "service_requests_customer_id_idx" ON "service_requests"("customer_id");

-- CreateIndex
CREATE INDEX "service_requests_assigned_agent_id_idx" ON "service_requests"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");

-- CreateIndex
CREATE INDEX "service_requests_city_id_idx" ON "service_requests"("city_id");

-- CreateIndex
CREATE INDEX "agent_assignment_logs_service_request_id_idx" ON "agent_assignment_logs"("service_request_id");

-- CreateIndex
CREATE INDEX "agent_assignment_logs_assigned_agent_id_idx" ON "agent_assignment_logs"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "agent_assignment_logs_city_id_idx" ON "agent_assignment_logs"("city_id");

-- CreateIndex
CREATE INDEX "checklists_service_code_idx" ON "checklists"("service_code");

-- CreateIndex
CREATE UNIQUE INDEX "checklists_task_id_key" ON "checklists"("task_id");

-- CreateIndex
CREATE INDEX "checklist_progress_task_id_idx" ON "checklist_progress"("task_id");

-- CreateIndex
CREATE INDEX "checklist_progress_checklist_id_idx" ON "checklist_progress"("checklist_id");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_progress_checklist_id_step_index_key" ON "checklist_progress"("checklist_id", "step_index");

-- CreateIndex
CREATE UNIQUE INDEX "sync_logs_idempotency_key_key" ON "sync_logs"("idempotency_key");

-- CreateIndex
CREATE INDEX "sync_logs_agent_id_idx" ON "sync_logs"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_receipts_receipt_id_key" ON "cash_receipts"("receipt_id");

-- CreateIndex
CREATE INDEX "cash_receipts_agent_id_idx" ON "cash_receipts"("agent_id");

-- CreateIndex
CREATE INDEX "cash_receipts_service_request_id_idx" ON "cash_receipts"("service_request_id");

-- CreateIndex
CREATE INDEX "cash_receipts_city_id_idx" ON "cash_receipts"("city_id");

-- CreateIndex
CREATE INDEX "cash_receipts_is_reconciled_idx" ON "cash_receipts"("is_reconciled");

-- CreateIndex
CREATE INDEX "cash_deposits_agent_id_idx" ON "cash_deposits"("agent_id");

-- CreateIndex
CREATE INDEX "cash_deposits_status_idx" ON "cash_deposits"("status");

-- CreateIndex
CREATE INDEX "cash_deposits_city_id_idx" ON "cash_deposits"("city_id");

-- CreateIndex
CREATE INDEX "cash_reconciliation_logs_city_id_idx" ON "cash_reconciliation_logs"("city_id");

-- CreateIndex
CREATE INDEX "cash_reconciliation_logs_reconciliation_date_idx" ON "cash_reconciliation_logs"("reconciliation_date");

-- CreateIndex
CREATE INDEX "cash_reconciliation_logs_status_idx" ON "cash_reconciliation_logs"("status");

-- CreateIndex
CREATE INDEX "pricing_slabs_service_definition_id_city_id_idx" ON "pricing_slabs"("service_definition_id", "city_id");

-- CreateIndex
CREATE INDEX "pricing_slabs_is_active_idx" ON "pricing_slabs"("is_active");

-- CreateIndex
CREATE INDEX "pricing_calculations_service_definition_id_idx" ON "pricing_calculations"("service_definition_id");

-- CreateIndex
CREATE INDEX "pricing_calculations_city_id_idx" ON "pricing_calculations"("city_id");

-- CreateIndex
CREATE INDEX "service_ratings_customer_id_idx" ON "service_ratings"("customer_id");

-- CreateIndex
CREATE INDEX "service_ratings_agent_id_idx" ON "service_ratings"("agent_id");

-- CreateIndex
CREATE INDEX "service_ratings_city_id_idx" ON "service_ratings"("city_id");

-- CreateIndex
CREATE INDEX "service_ratings_rating_idx" ON "service_ratings"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "service_ratings_service_instance_id_customer_id_key" ON "service_ratings"("service_instance_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_referrals_customer_id_key" ON "customer_referrals"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_referrals_referral_code_key" ON "customer_referrals"("referral_code");

-- CreateIndex
CREATE INDEX "customer_referrals_city_id_idx" ON "customer_referrals"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_configs_tier_key" ON "referral_configs"("tier");

-- CreateIndex
CREATE INDEX "customer_referral_credits_referrer_customer_id_idx" ON "customer_referral_credits"("referrer_customer_id");

-- CreateIndex
CREATE INDEX "customer_referral_credits_referred_customer_id_idx" ON "customer_referral_credits"("referred_customer_id");

-- CreateIndex
CREATE INDEX "customer_referral_credits_city_id_idx" ON "customer_referral_credits"("city_id");

-- CreateIndex
CREATE INDEX "customer_referral_credits_expires_at_idx" ON "customer_referral_credits"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_referral_credits_referrer_customer_id_referred_cus_key" ON "customer_referral_credits"("referrer_customer_id", "referred_customer_id");

-- CreateIndex
CREATE INDEX "fee_variances_service_request_id_idx" ON "fee_variances"("service_request_id");

-- CreateIndex
CREATE INDEX "fee_variances_status_idx" ON "fee_variances"("status");

-- CreateIndex
CREATE INDEX "fee_variances_city_id_idx" ON "fee_variances"("city_id");

-- CreateIndex
CREATE INDEX "role_requests_status_idx" ON "role_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "role_requests_user_id_requested_role_status_key" ON "role_requests"("user_id", "requested_role", "status");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_service_request_id_idx" ON "refunds"("service_request_id");

-- CreateIndex
CREATE INDEX "refunds_customer_id_idx" ON "refunds"("customer_id");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "refunds_city_id_idx" ON "refunds"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "support_tickets_customer_id_idx" ON "support_tickets"("customer_id");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_city_id_idx" ON "support_tickets"("city_id");

-- CreateIndex
CREATE INDEX "support_tickets_assigned_to_idx" ON "support_tickets"("assigned_to");

-- CreateIndex
CREATE INDEX "support_tickets_priority_status_idx" ON "support_tickets"("priority", "status");

-- CreateIndex
CREATE INDEX "support_ticket_messages_ticket_id_idx" ON "support_ticket_messages"("ticket_id");

-- CreateIndex
CREATE INDEX "franchise_territories_city_id_idx" ON "franchise_territories"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "franchise_territories_franchise_id_city_id_key" ON "franchise_territories"("franchise_id", "city_id");

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_service_instance_id_fkey" FOREIGN KEY ("service_instance_id") REFERENCES "service_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_assignment_logs" ADD CONSTRAINT "agent_assignment_logs_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_assignment_logs" ADD CONSTRAINT "agent_assignment_logs_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_progress" ADD CONSTRAINT "checklist_progress_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_receipts" ADD CONSTRAINT "cash_receipts_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_receipts" ADD CONSTRAINT "cash_receipts_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_receipts" ADD CONSTRAINT "cash_receipts_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "cash_deposits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_deposits" ADD CONSTRAINT "cash_deposits_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_reconciliation_logs" ADD CONSTRAINT "cash_reconciliation_logs_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_slabs" ADD CONSTRAINT "pricing_slabs_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_calculations" ADD CONSTRAINT "pricing_calculations_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_ratings" ADD CONSTRAINT "service_ratings_service_instance_id_fkey" FOREIGN KEY ("service_instance_id") REFERENCES "service_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_ratings" ADD CONSTRAINT "service_ratings_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_referral_credits" ADD CONSTRAINT "customer_referral_credits_referrer_customer_id_fkey" FOREIGN KEY ("referrer_customer_id") REFERENCES "customer_referrals"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_referral_credits" ADD CONSTRAINT "customer_referral_credits_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_variances" ADD CONSTRAINT "fee_variances_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_variances" ADD CONSTRAINT "fee_variances_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchise_territories" ADD CONSTRAINT "franchise_territories_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "franchises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateSequence: Atomic request number generation for PLA-YYYY-NNNNN format
CREATE SEQUENCE IF NOT EXISTS "service_request_number_seq"
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;
