-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "current_lat" DOUBLE PRECISION,
ADD COLUMN     "current_lng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "dealers" ADD COLUMN     "deactivation_reason" TEXT,
ADD COLUMN     "tier_config" JSONB;

-- AlterTable
ALTER TABLE "escalations" ADD COLUMN     "escalation_type" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "corrected_at" TIMESTAMP(3),
ADD COLUMN     "corrected_by" TEXT,
ADD COLUMN     "correction_note" TEXT;

-- AlterTable
ALTER TABLE "service_instances" ADD COLUMN     "property_lat" DOUBLE PRECISION,
ADD COLUMN     "property_lng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "attorney_whatsapp" TEXT,
ADD COLUMN     "authorized_attorney_name" TEXT,
ADD COLUMN     "authorized_attorney_phone" TEXT,
ADD COLUMN     "customer_name" TEXT,
ADD COLUMN     "customer_phone" TEXT,
ADD COLUMN     "govt_fee_estimate_paise" INTEGER,
ADD COLUMN     "has_verified_poa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "poa_document_id" TEXT,
ADD COLUMN     "property_address" TEXT,
ADD COLUMN     "service_fee_paise" INTEGER,
ADD COLUMN     "service_name" TEXT;

-- AlterTable
ALTER TABLE "training_modules" ADD COLUMN     "category" TEXT,
ADD COLUMN     "content" JSONB,
ADD COLUMN     "estimated_minutes" INTEGER,
ADD COLUMN     "passing_score_percent" INTEGER NOT NULL DEFAULT 70,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "title_hi" TEXT;

-- AlterTable
ALTER TABLE "training_progress" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_attempt_at" TIMESTAMP(3),
ADD COLUMN     "passed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "score_percent" INTEGER;

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "metadata" JSONB,
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_comments" (
    "id" TEXT NOT NULL,
    "dispute_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_state_changes" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "old_state" TEXT NOT NULL,
    "new_state" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_state_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "razorpay_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "razorpay_payment_id" TEXT NOT NULL,
    "razorpay_order_id" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_usage_logs" (
    "id" TEXT NOT NULL,
    "credit_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount_used_paise" BIGINT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_evidence" (
    "id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "photo_urls" TEXT[],
    "captured_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_status_logs" (
    "id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disputes_service_request_id_idx" ON "disputes"("service_request_id");

-- CreateIndex
CREATE INDEX "disputes_agent_id_idx" ON "disputes"("agent_id");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "disputes_city_id_idx" ON "disputes"("city_id");

-- CreateIndex
CREATE INDEX "dispute_comments_dispute_id_idx" ON "dispute_comments"("dispute_id");

-- CreateIndex
CREATE INDEX "payment_state_changes_payment_id_idx" ON "payment_state_changes"("payment_id");

-- CreateIndex
CREATE INDEX "payment_state_changes_created_at_idx" ON "payment_state_changes"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_razorpay_event_id_key" ON "webhook_events"("razorpay_event_id");

-- CreateIndex
CREATE INDEX "webhook_events_razorpay_payment_id_idx" ON "webhook_events"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_razorpay_payment_id_event_type_key" ON "webhook_events"("razorpay_payment_id", "event_type");

-- CreateIndex
CREATE INDEX "credit_usage_logs_credit_id_idx" ON "credit_usage_logs"("credit_id");

-- CreateIndex
CREATE INDEX "credit_usage_logs_customer_id_idx" ON "credit_usage_logs"("customer_id");

-- CreateIndex
CREATE INDEX "credit_usage_logs_service_request_id_idx" ON "credit_usage_logs"("service_request_id");

-- CreateIndex
CREATE INDEX "gps_evidence_service_request_id_idx" ON "gps_evidence"("service_request_id");

-- CreateIndex
CREATE INDEX "gps_evidence_agent_id_idx" ON "gps_evidence"("agent_id");

-- CreateIndex
CREATE INDEX "service_request_status_logs_service_request_id_idx" ON "service_request_status_logs"("service_request_id");

-- CreateIndex
CREATE INDEX "service_request_status_logs_created_at_idx" ON "service_request_status_logs"("created_at");

-- AddForeignKey
ALTER TABLE "agent_assignment_logs" ADD CONSTRAINT "agent_assignment_logs_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_comments" ADD CONSTRAINT "dispute_comments_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_state_changes" ADD CONSTRAINT "payment_state_changes_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_usage_logs" ADD CONSTRAINT "credit_usage_logs_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_evidence" ADD CONSTRAINT "gps_evidence_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_status_logs" ADD CONSTRAINT "service_request_status_logs_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
