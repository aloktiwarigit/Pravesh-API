-- CreateEnum
CREATE TYPE "DealerStatus" AS ENUM ('PENDING_KYC', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DealerTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReferralSource" AS ENUM ('LINK', 'QR');

-- CreateEnum
CREATE TYPE "AttributionStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('FIRST_REFERRAL', 'FIVE_REFERRALS', 'FIRST_PAYOUT', 'SILVER_TIER', 'GOLD_TIER', 'TOP_10_LEADERBOARD', 'HUNDRED_REFERRALS_LIFETIME');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('SAVINGS', 'CURRENT');

-- CreateEnum
CREATE TYPE "DealerPayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "LawyerStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LawyerTier" AS ENUM ('STANDARD', 'PREFERRED');

-- CreateEnum
CREATE TYPE "ExpertiseTag" AS ENUM ('LDA_DISPUTES', 'TITLE_OPINIONS', 'RERA_MATTERS', 'SUCCESSION_LEGAL_HEIR', 'AGRICULTURAL_LAND_CONVERSION', 'ENCUMBRANCE_ISSUES', 'MUTATION_CHALLENGES', 'PROPERTY_TAX_DISPUTES');

-- CreateEnum
CREATE TYPE "ExpertiseRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LegalCaseStatus" AS ENUM ('ASSIGNED', 'PENDING_ACCEPTANCE', 'IN_PROGRESS', 'OPINION_SUBMITTED', 'OPINION_APPROVED', 'OPINION_DELIVERED', 'COMPLETED', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "OpinionType" AS ENUM ('FAVORABLE', 'ADVERSE', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "OpinionApproval" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "builder_status" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "project_type" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'MIXED');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "notification_event_type" AS ENUM ('service_status_change', 'payment_confirmation', 'document_delivered', 'sla_alert', 'auto_reassurance', 'disruption_broadcast', 'task_assignment', 'agent_communication', 'campaign_marketing', 'receipt_delivery', 'otp', 'payment_link');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('push', 'whatsapp', 'sms');

-- CreateEnum
CREATE TYPE "template_language" AS ENUM ('hi', 'en');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "notification_priority" AS ENUM ('high', 'normal', 'low');

-- CreateEnum
CREATE TYPE "campaign_status" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "communication_type" AS ENUM ('whatsapp_call', 'whatsapp_video', 'whatsapp_message', 'auto_reassurance', 'status_update', 'halt_alert', 'disruption_broadcast', 'disruption_resolved');

-- CreateEnum
CREATE TYPE "unit_status" AS ENUM ('PENDING_SERVICES', 'SERVICES_ACTIVE', 'SERVICES_COMPLETED');

-- CreateEnum
CREATE TYPE "bulk_service_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "pricing_tier_status" AS ENUM ('AUTO', 'CUSTOM_PENDING', 'CUSTOM_APPROVED', 'CUSTOM_REJECTED');

-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'AMENDMENT_PENDING', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "broadcast_status" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENDING', 'SENT', 'REJECTED');

-- CreateEnum
CREATE TYPE "message_delivery_status" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('DOCUMENT_REQUESTS', 'TIMELINE_UPDATES', 'ISSUE_RESOLUTION', 'GENERAL_INQUIRY');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('FOLLOW_UP_CUSTOMER', 'CHECK_WITH_AGENT', 'ESCALATE_TO_OPS');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'COMPLETED', 'SNOOZED');

-- CreateEnum
CREATE TYPE "PatternCategory" AS ENUM ('DOCUMENT_CONFUSION', 'PAYMENT_ISSUES', 'AGENT_COMMUNICATION_GAP', 'GOVERNMENT_OFFICE_DELAYS', 'SLA_MISALIGNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('POSITIVE_FEEDBACK', 'CONCERN', 'NEUTRAL_OBSERVATION');

-- CreateEnum
CREATE TYPE "EscalationType" AS ENUM ('CUSTOMER_COMPLAINT', 'SLA_BREACH', 'AGENT_ISSUE', 'AUTO_GENERATED');

-- CreateEnum
CREATE TYPE "EscalationSeverity" AS ENUM ('STANDARD', 'COMPLEX');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED_TO_OPS');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('SUPPORT_AGENT', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('PUSH_ONLY', 'PUSH_AND_WHATSAPP');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING_DELIVERY', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "city_name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "active_status" BOOLEAN NOT NULL DEFAULT true,
    "config_data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city_service_fees" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "service_definition_id" TEXT NOT NULL,
    "fee_config" JSONB NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_service_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city_process_overrides" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "service_definition_id" TEXT NOT NULL,
    "custom_steps" JSONB NOT NULL,
    "conditional_rules" JSONB,
    "approval_status" TEXT NOT NULL DEFAULT 'pending_approval',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_process_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city_document_requirements" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "service_definition_id" TEXT NOT NULL,
    "documents" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franchise_applications" (
    "id" TEXT NOT NULL,
    "applicant_name" TEXT NOT NULL,
    "applicant_email" TEXT NOT NULL,
    "applicant_phone" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "business_experience" TEXT NOT NULL,
    "financial_capacity" TEXT NOT NULL,
    "references" JSONB NOT NULL,
    "business_plan_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "review_checklist" JSONB,
    "review_notes" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "agreement_doc_url" TEXT,
    "signed_agreement_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchise_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franchises" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "owner_email" TEXT NOT NULL,
    "owner_phone" TEXT NOT NULL,
    "contract_terms" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "onboarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "photo_url" TEXT,
    "service_areas" JSONB,
    "expertise_tags" TEXT[],
    "max_concurrent_tasks" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "training_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dealer_code" TEXT,
    "business_name" TEXT,
    "dealer_status" "DealerStatus" NOT NULL DEFAULT 'PENDING_KYC',
    "current_tier" "DealerTier" NOT NULL DEFAULT 'BRONZE',
    "tier_start_date" TIMESTAMP(3),
    "previous_tier" "DealerTier",
    "qr_code_url" TEXT,
    "whitelabel_enabled" BOOLEAN NOT NULL DEFAULT false,
    "logo_url" TEXT,
    "brand_color" TEXT,
    "display_name_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_kyc" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "pan_number" TEXT NOT NULL,
    "pan_photo_url" TEXT NOT NULL,
    "aadhaar_masked" TEXT NOT NULL,
    "aadhaar_photo_url" TEXT,
    "business_address" TEXT,
    "ifsc_code" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_holder_name" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "rejection_notes" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_link_clicks" (
    "id" TEXT NOT NULL,
    "dealer_code" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "ip_address" TEXT,
    "clicked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_link_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_referrals" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "referral_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referral_source" "ReferralSource" NOT NULL,
    "attribution_status" "AttributionStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMP(3),
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_commissions" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "referral_id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "service_fee_paise" BIGINT NOT NULL,
    "commission_rate" INTEGER NOT NULL,
    "commission_amount_paise" BIGINT NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "earned_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "payout_id" TEXT,
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_tier_history" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "previous_tier" "DealerTier" NOT NULL,
    "new_tier" "DealerTier" NOT NULL,
    "referral_count" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_tier_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_leaderboard_snapshots" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "referral_count" INTEGER NOT NULL,
    "total_commission_paise" BIGINT NOT NULL,
    "period" TEXT NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_badges" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "badge_type" "BadgeType" NOT NULL,
    "earned_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_bank_accounts" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "account_holder_name" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "ifsc_code" TEXT NOT NULL,
    "account_number_masked" TEXT NOT NULL,
    "account_number_encrypted" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_code" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_payouts" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "payout_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount_paise" BIGINT NOT NULL,
    "transaction_id" TEXT,
    "status" "DealerPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "failure_reason" TEXT,
    "processed_at" TIMESTAMP(3),
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franchise_revenues" (
    "id" TEXT NOT NULL,
    "franchise_id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "service_fee_paise" INTEGER NOT NULL,
    "franchise_share_paise" INTEGER NOT NULL,
    "platform_share_paise" INTEGER NOT NULL,
    "franchise_share_bps" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adjustments" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchise_revenues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_modules" (
    "id" TEXT NOT NULL,
    "city_id" TEXT,
    "module_name" TEXT NOT NULL,
    "description" TEXT,
    "content_type" TEXT NOT NULL,
    "content_url" TEXT,
    "quiz_data" JSONB,
    "learning_path" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_progress" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "training_module_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "quiz_score" INTEGER,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_audits" (
    "id" TEXT NOT NULL,
    "franchise_id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "audit_type" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "auditor_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "checklist" JSONB,
    "findings" JSONB,
    "findings_report_url" TEXT,
    "corrective_actions" JSONB,
    "franchise_response" TEXT,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_schedule" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corporate_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" TEXT NOT NULL,
    "city_id" TEXT,
    "user_id" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "export_type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filters" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "file_url" TEXT,
    "expires_at" TIMESTAMP(3),
    "row_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_usage_events" (
    "id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "user_id" TEXT,
    "user_role" TEXT,
    "city_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bigquery_sync_logs" (
    "id" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_count" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER NOT NULL,

    CONSTRAINT "bigquery_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "payment_method_type" TEXT NOT NULL DEFAULT 'domestic',
    "is_nri_payment" BOOLEAN NOT NULL DEFAULT false,
    "foreign_currency_amount" INTEGER,
    "foreign_currency_code" TEXT,
    "exchange_rate" DECIMAL(12,6),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wire_transfers" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "reference_code" TEXT NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "foreign_currency_code" TEXT,
    "foreign_amount" INTEGER,
    "bank_name" TEXT NOT NULL DEFAULT 'HDFC Bank',
    "swift_code" TEXT NOT NULL DEFAULT 'HDFCINBB',
    "account_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "received_amount" INTEGER,
    "variance_amount" INTEGER,
    "bank_statement_url" TEXT,
    "reconciled_by_user_id" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "sla_deadline" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wire_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rate_snapshots" (
    "id" TEXT NOT NULL,
    "rates" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rate_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_audit_logs" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "wire_transfer_id" TEXT,
    "action" TEXT NOT NULL,
    "performed_by" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poa_documents" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "service_request_id" TEXT,
    "attorney_name" TEXT NOT NULL,
    "attorney_address" TEXT NOT NULL,
    "attorney_phone" TEXT NOT NULL,
    "scope_of_authority" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "validity_start_date" TIMESTAMP(3) NOT NULL,
    "validity_end_date" TIMESTAMP(3) NOT NULL,
    "template_version" TEXT NOT NULL DEFAULT '1.0',
    "document_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notarized_poa_url" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'pending',
    "verification_notes" TEXT,
    "rejection_reason" TEXT,
    "embassy_seal" BOOLEAN,
    "notarization_date_valid" BOOLEAN,
    "attorney_details_match" BOOLEAN,
    "scope_adequate" BOOLEAN,
    "validity_confirmed" BOOLEAN,
    "notarized_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" TEXT,
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poa_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poa_execution_steps" (
    "id" TEXT NOT NULL,
    "poa_document_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "embassy_name" TEXT,
    "embassy_city" TEXT,
    "embassy_country" TEXT,
    "appointment_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poa_execution_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_hearings" (
    "id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "hearing_date" TIMESTAMP(3) NOT NULL,
    "court_name" TEXT NOT NULL,
    "court_address" TEXT,
    "hearing_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "outcome" TEXT,
    "notes" TEXT,
    "next_hearing_date" TIMESTAMP(3),
    "adjournment_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "court_hearings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_orders" (
    "id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "hearing_id" TEXT,
    "case_number" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL,
    "order_type" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "document_url" TEXT NOT NULL,
    "summary" TEXT,
    "uploaded_by_user_id" TEXT NOT NULL,
    "customer_notified" BOOLEAN NOT NULL DEFAULT false,
    "customer_decision" TEXT,
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "court_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_events" (
    "id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "next_action" TEXT,
    "is_milestone" BOOLEAN NOT NULL DEFAULT false,
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "court_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "service_request_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "consultant_id" TEXT NOT NULL,
    "consultant_type" TEXT NOT NULL,
    "scheduled_at_utc" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "customer_timezone" TEXT NOT NULL,
    "consultant_timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "video_call_url" TEXT,
    "fallback_phone" TEXT,
    "rescheduled_from_id" TEXT,
    "reschedule_count" INTEGER NOT NULL DEFAULT 0,
    "missed_by_user_id" TEXT,
    "no_show_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultant_availability" (
    "id" TEXT NOT NULL,
    "consultant_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time_utc" TEXT NOT NULL,
    "end_time_utc" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "consultant_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nri_document_submissions" (
    "id" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "scanned_copy_url" TEXT,
    "scanned_copy_status" TEXT NOT NULL DEFAULT 'pending',
    "scanned_copy_notes" TEXT,
    "original_required" BOOLEAN NOT NULL DEFAULT true,
    "courier_service" TEXT,
    "courier_tracking_number" TEXT,
    "courier_status" TEXT,
    "courier_shipped_date" TIMESTAMP(3),
    "courier_delivery_date" TIMESTAMP(3),
    "original_received_date" TIMESTAMP(3),
    "original_matches_scan" BOOLEAN,
    "mismatch_notes" TEXT,
    "submitted_via_attorney" BOOLEAN NOT NULL DEFAULT false,
    "provisional_approval" BOOLEAN NOT NULL DEFAULT false,
    "provisional_deadline" TIMESTAMP(3),
    "verified_by_agent_id" TEXT,
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nri_document_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bar_council_number" TEXT NOT NULL,
    "state_bar_council" TEXT NOT NULL,
    "admission_year" INTEGER NOT NULL,
    "practicing_cert_url" TEXT NOT NULL,
    "bar_council_id_url" TEXT,
    "lawyer_status" "LawyerStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "lawyer_tier" "LawyerTier" NOT NULL DEFAULT 'STANDARD',
    "commission_rate" INTEGER NOT NULL DEFAULT 20,
    "dnd_enabled" BOOLEAN NOT NULL DEFAULT false,
    "decline_count" INTEGER NOT NULL DEFAULT 0,
    "total_cases_completed" INTEGER NOT NULL DEFAULT 0,
    "avg_rating" DECIMAL(3,2),
    "rejection_reason" TEXT,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lawyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_expertise" (
    "id" TEXT NOT NULL,
    "lawyer_id" TEXT NOT NULL,
    "expertise_tag" "ExpertiseTag" NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lawyer_expertise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_expertise_requests" (
    "id" TEXT NOT NULL,
    "lawyer_id" TEXT NOT NULL,
    "requested_tag" "ExpertiseTag" NOT NULL,
    "supporting_doc_url" TEXT,
    "status" "ExpertiseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lawyer_expertise_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_cases" (
    "id" TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "service_request_id" TEXT NOT NULL,
    "lawyer_id" TEXT NOT NULL,
    "required_expertise" "ExpertiseTag" NOT NULL,
    "case_priority" "CasePriority" NOT NULL DEFAULT 'NORMAL',
    "case_status" "LegalCaseStatus" NOT NULL DEFAULT 'ASSIGNED',
    "issue_summary" TEXT,
    "case_fee_in_paise" INTEGER NOT NULL,
    "platform_commission" INTEGER NOT NULL,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "decline_reason" TEXT,
    "completed_at" TIMESTAMP(3),
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_case_doc_access" (
    "id" TEXT NOT NULL,
    "legal_case_id" TEXT NOT NULL,
    "lawyer_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "access_type" TEXT NOT NULL DEFAULT 'view',

    CONSTRAINT "legal_case_doc_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_case_doc_requests" (
    "id" TEXT NOT NULL,
    "legal_case_id" TEXT NOT NULL,
    "lawyer_id" TEXT NOT NULL,
    "request_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_case_doc_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_opinions" (
    "id" TEXT NOT NULL,
    "legal_case_id" TEXT NOT NULL,
    "lawyer_id" TEXT NOT NULL,
    "opinion_doc_url" TEXT NOT NULL,
    "opinion_type" "OpinionType" NOT NULL,
    "summary" VARCHAR(500),
    "conditions" TEXT,
    "approval_status" "OpinionApproval" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_opinions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_payouts" (
    "id" TEXT NOT NULL,
    "lawyer_id" TEXT NOT NULL,
    "legal_case_id" TEXT NOT NULL,
    "gross_fee_in_paise" INTEGER NOT NULL,
    "commission_rate" INTEGER NOT NULL,
    "commission_in_paise" INTEGER NOT NULL,
    "net_payout_in_paise" INTEGER NOT NULL,
    "payout_status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "payout_batch_id" TEXT,
    "transaction_id" TEXT,
    "payout_method" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lawyer_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_bank_accounts" (
    "id" TEXT NOT NULL,
    "lawyer_id" TEXT NOT NULL,
    "account_holder_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "ifsc_code" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "upi_id" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lawyer_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_opinion_ratings" (
    "id" TEXT NOT NULL,
    "legal_case_id" TEXT NOT NULL,
    "lawyer_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" VARCHAR(500),
    "rated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_opinion_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "rera_number" TEXT NOT NULL,
    "gst_number" TEXT NOT NULL,
    "contact_email" TEXT,
    "contact_phone" TEXT NOT NULL,
    "status" "builder_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "city_id" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "template_code" TEXT NOT NULL,
    "event_type" "notification_event_type" NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "language" "template_language" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_template_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_code" TEXT NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "language" "template_language" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "context_data_hash" TEXT,
    "service_instance_id" TEXT,
    "priority" "notification_priority" NOT NULL DEFAULT 'normal',
    "status" "notification_status" NOT NULL DEFAULT 'queued',
    "external_message_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_notifications" (
    "id" TEXT NOT NULL,
    "notification_log_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_code" TEXT NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "context_data" JSONB NOT NULL,
    "failure_reason" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_opt_outs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "opted_out_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_cost_log" (
    "id" TEXT NOT NULL,
    "notification_message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cost_in_paise" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_cost_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_code" TEXT NOT NULL,
    "audience_filter" JSONB NOT NULL,
    "parameters" JSONB NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "status" "campaign_status" NOT NULL DEFAULT 'DRAFT',
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "read_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "service_updates_push" BOOLEAN NOT NULL DEFAULT true,
    "service_updates_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "payment_push" BOOLEAN NOT NULL DEFAULT true,
    "payment_sms" BOOLEAN NOT NULL DEFAULT true,
    "document_push" BOOLEAN NOT NULL DEFAULT true,
    "document_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "marketing_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "preferred_language" "template_language" NOT NULL DEFAULT 'hi',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_communications" (
    "id" TEXT NOT NULL,
    "service_instance_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "customer_id" TEXT,
    "communication_type" "communication_type" NOT NULL,
    "channel" TEXT,
    "message_template" TEXT,
    "message_content" TEXT,
    "metadata" JSONB,
    "delivery_status" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builder_projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "builder_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "total_units" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "project_type" "project_type" NOT NULL,
    "city_id" TEXT NOT NULL,
    "status" "project_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builder_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "unit_number" TEXT NOT NULL,
    "buyer_name" TEXT NOT NULL,
    "buyer_phone" TEXT NOT NULL,
    "buyer_email" TEXT,
    "buyer_user_id" TEXT,
    "status" "unit_status" NOT NULL DEFAULT 'PENDING_SERVICES',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_service_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "builder_id" UUID NOT NULL,
    "service_ids" TEXT[],
    "package_ids" TEXT[],
    "unit_ids" TEXT[],
    "all_units" BOOLEAN NOT NULL DEFAULT false,
    "unit_count" INTEGER NOT NULL,
    "status" "bulk_service_status" NOT NULL DEFAULT 'PENDING',
    "total_fee_paise" BIGINT NOT NULL,
    "discount_pct" INTEGER NOT NULL DEFAULT 0,
    "discounted_fee_paise" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builder_pricing_tiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "builder_id" UUID NOT NULL,
    "unit_count" INTEGER NOT NULL,
    "tier_name" TEXT NOT NULL,
    "discount_pct" INTEGER NOT NULL,
    "status" "pricing_tier_status" NOT NULL DEFAULT 'AUTO',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builder_pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builder_contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "builder_id" UUID NOT NULL,
    "project_id" UUID,
    "contract_number" TEXT NOT NULL,
    "service_ids" TEXT[],
    "unit_count" INTEGER NOT NULL,
    "discount_pct" INTEGER NOT NULL,
    "status" "contract_status" NOT NULL DEFAULT 'DRAFT',
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3) NOT NULL,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "total_value_paise" BIGINT NOT NULL,
    "utilized_units" INTEGER NOT NULL DEFAULT 0,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "amendment_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builder_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builder_broadcasts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "builder_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "recipient_filter" JSONB,
    "recipient_count" INTEGER NOT NULL,
    "status" "broadcast_status" NOT NULL DEFAULT 'DRAFT',
    "approved_by" UUID,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builder_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "broadcast_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "buyer_phone" TEXT NOT NULL,
    "status" "message_delivery_status" NOT NULL DEFAULT 'QUEUED',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builder_inbox_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "builder_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "sender_phone" TEXT NOT NULL,
    "sender_name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_agent_messages" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "message_text" TEXT NOT NULL,
    "attachment_url" TEXT,
    "attachment_type" TEXT,
    "read_status" BOOLEAN NOT NULL DEFAULT false,
    "thread_status" "ThreadStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_templates" (
    "id" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL,
    "template_text_en" TEXT NOT NULL,
    "template_text_hi" TEXT NOT NULL,
    "placeholders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_template_usage" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "used_by" TEXT NOT NULL,
    "service_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_template_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_reminders" (
    "id" TEXT NOT NULL,
    "support_agent_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "reminder_datetime" TIMESTAMP(3) NOT NULL,
    "reminder_type" "ReminderType" NOT NULL,
    "notes" TEXT,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "snoozed_until" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_case_patterns" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "pattern_category" "PatternCategory" NOT NULL,
    "notes" TEXT,
    "logged_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_case_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_performance_notes" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "note_type" "NoteType" NOT NULL,
    "notes" TEXT NOT NULL,
    "logged_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_performance_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_escalations" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "assigned_agent_id" TEXT,
    "escalation_type" "EscalationType" NOT NULL,
    "escalation_reason" TEXT NOT NULL,
    "severity" "EscalationSeverity" NOT NULL DEFAULT 'STANDARD',
    "status" "EscalationStatus" NOT NULL DEFAULT 'OPEN',
    "first_response_due" TIMESTAMP(3) NOT NULL,
    "resolution_due" TIMESTAMP(3) NOT NULL,
    "first_response_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "first_response_breached" BOOLEAN NOT NULL DEFAULT false,
    "resolution_breached" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_customer_messages" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_type" "SenderType" NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "subject" TEXT,
    "message_text" TEXT NOT NULL,
    "attachment_url" TEXT,
    "delivery_channel" "DeliveryChannel" NOT NULL,
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING_DELIVERY',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_customer_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_agent_metrics" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "cases_handled" INTEGER NOT NULL DEFAULT 0,
    "cases_resolved" INTEGER NOT NULL DEFAULT 0,
    "avg_first_response_minutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_resolution_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "first_response_sla_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resolution_sla_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "patterns_logged" INTEGER NOT NULL DEFAULT 0,
    "customer_satisfaction" DOUBLE PRECISION,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_agent_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "service_instance_id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "download_url" TEXT NOT NULL,
    "signed_url" TEXT,
    "signed_url_expires_at" TIMESTAMP(3),
    "file_size" INTEGER NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verification_status" TEXT NOT NULL DEFAULT 'pending',
    "ai_verification_result" JSONB,
    "rejection_reason" TEXT,
    "verification_overridden_by" TEXT,
    "verification_overridden_at" TIMESTAMP(3),
    "stakeholder_id" TEXT,
    "agent_notes" TEXT,
    "gps_lat" DECIMAL(10,7),
    "gps_lng" DECIMAL(10,7),
    "archived_at" TIMESTAMP(3),
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_execution_logs" (
    "id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "document_id" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_review_tasks" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_to" TEXT,
    "metadata" JSONB,
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ops_review_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_accuracy_flags" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "original_ai_result" JSONB NOT NULL,
    "human_decision" TEXT NOT NULL,
    "flagged_by" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_accuracy_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_case_assignments" (
    "id" TEXT NOT NULL,
    "lawyer_id" TEXT NOT NULL,
    "service_instance_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "city_id" TEXT NOT NULL,

    CONSTRAINT "lawyer_case_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_stakeholders" (
    "id" TEXT NOT NULL,
    "service_instance_id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'stakeholder',
    "status" TEXT NOT NULL DEFAULT 'invited',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_stakeholders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_deletion_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "processed_at" TIMESTAMP(3),
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_audit_logs" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deletion_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "service_instance_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_info" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "city_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discount_percent" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "definition" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_items" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "service_definition_id" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_instances" (
    "id" TEXT NOT NULL,
    "service_definition_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "assigned_agent_id" TEXT,
    "package_instance_id" TEXT,
    "city_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'requested',
    "current_step_index" INTEGER NOT NULL DEFAULT 0,
    "sla_deadline" TIMESTAMP(3),
    "sla_paused_at" TIMESTAMP(3),
    "sla_paused_duration" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_state_history" (
    "id" TEXT NOT NULL,
    "service_instance_id" TEXT NOT NULL,
    "from_state" TEXT NOT NULL,
    "to_state" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_state_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalations" (
    "id" TEXT NOT NULL,
    "service_instance_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assigned_to" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "city_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disruptions" (
    "id" TEXT NOT NULL,
    "office_name" TEXT NOT NULL,
    "department" TEXT,
    "disruption_type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "affected_count" INTEGER NOT NULL DEFAULT 0,
    "city_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disruptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cities_active_status_idx" ON "cities"("active_status");

-- CreateIndex
CREATE UNIQUE INDEX "cities_city_name_state_key" ON "cities"("city_name", "state");

-- CreateIndex
CREATE INDEX "city_service_fees_city_id_service_definition_id_is_active_idx" ON "city_service_fees"("city_id", "service_definition_id", "is_active");

-- CreateIndex
CREATE INDEX "city_service_fees_effective_from_idx" ON "city_service_fees"("effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "city_service_fees_city_id_service_definition_id_effective_f_key" ON "city_service_fees"("city_id", "service_definition_id", "effective_from");

-- CreateIndex
CREATE INDEX "city_process_overrides_city_id_service_definition_id_is_act_idx" ON "city_process_overrides"("city_id", "service_definition_id", "is_active");

-- CreateIndex
CREATE INDEX "city_process_overrides_approval_status_idx" ON "city_process_overrides"("approval_status");

-- CreateIndex
CREATE UNIQUE INDEX "city_process_overrides_city_id_service_definition_id_versio_key" ON "city_process_overrides"("city_id", "service_definition_id", "version");

-- CreateIndex
CREATE INDEX "city_document_requirements_city_id_is_active_idx" ON "city_document_requirements"("city_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "city_document_requirements_city_id_service_definition_id_key" ON "city_document_requirements"("city_id", "service_definition_id");

-- CreateIndex
CREATE INDEX "franchise_applications_status_idx" ON "franchise_applications"("status");

-- CreateIndex
CREATE INDEX "franchise_applications_city_id_idx" ON "franchise_applications"("city_id");

-- CreateIndex
CREATE INDEX "franchises_is_active_idx" ON "franchises"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "franchises_city_id_key" ON "franchises"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "franchises_owner_user_id_key" ON "franchises"("owner_user_id");

-- CreateIndex
CREATE INDEX "agents_city_id_is_active_idx" ON "agents"("city_id", "is_active");

-- CreateIndex
CREATE INDEX "agents_city_id_idx" ON "agents"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "agents_user_id_key" ON "agents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealers_user_id_key" ON "dealers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealers_dealer_code_key" ON "dealers"("dealer_code");

-- CreateIndex
CREATE INDEX "dealers_city_id_idx" ON "dealers"("city_id");

-- CreateIndex
CREATE INDEX "dealers_dealer_status_idx" ON "dealers"("dealer_status");

-- CreateIndex
CREATE INDEX "dealers_current_tier_idx" ON "dealers"("current_tier");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_kyc_dealer_id_key" ON "dealer_kyc"("dealer_id");

-- CreateIndex
CREATE INDEX "dealer_kyc_status_idx" ON "dealer_kyc"("status");

-- CreateIndex
CREATE INDEX "dealer_link_clicks_dealer_code_idx" ON "dealer_link_clicks"("dealer_code");

-- CreateIndex
CREATE INDEX "dealer_link_clicks_clicked_at_idx" ON "dealer_link_clicks"("clicked_at");

-- CreateIndex
CREATE INDEX "dealer_referrals_dealer_id_idx" ON "dealer_referrals"("dealer_id");

-- CreateIndex
CREATE INDEX "dealer_referrals_customer_id_idx" ON "dealer_referrals"("customer_id");

-- CreateIndex
CREATE INDEX "dealer_referrals_city_id_idx" ON "dealer_referrals"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_referrals_dealer_id_customer_id_key" ON "dealer_referrals"("dealer_id", "customer_id");

-- CreateIndex
CREATE INDEX "dealer_commissions_dealer_id_status_idx" ON "dealer_commissions"("dealer_id", "status");

-- CreateIndex
CREATE INDEX "dealer_commissions_status_idx" ON "dealer_commissions"("status");

-- CreateIndex
CREATE INDEX "dealer_commissions_city_id_idx" ON "dealer_commissions"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_commissions_dealer_id_service_request_id_key" ON "dealer_commissions"("dealer_id", "service_request_id");

-- CreateIndex
CREATE INDEX "dealer_tier_history_dealer_id_idx" ON "dealer_tier_history"("dealer_id");

-- CreateIndex
CREATE INDEX "dealer_leaderboard_snapshots_city_id_period_snapshot_date_idx" ON "dealer_leaderboard_snapshots"("city_id", "period", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_leaderboard_snapshots_dealer_id_period_snapshot_date_key" ON "dealer_leaderboard_snapshots"("dealer_id", "period", "snapshot_date");

-- CreateIndex
CREATE INDEX "dealer_badges_dealer_id_idx" ON "dealer_badges"("dealer_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_badges_dealer_id_badge_type_key" ON "dealer_badges"("dealer_id", "badge_type");

-- CreateIndex
CREATE INDEX "dealer_bank_accounts_dealer_id_idx" ON "dealer_bank_accounts"("dealer_id");

-- CreateIndex
CREATE INDEX "dealer_payouts_dealer_id_idx" ON "dealer_payouts"("dealer_id");

-- CreateIndex
CREATE INDEX "dealer_payouts_status_idx" ON "dealer_payouts"("status");

-- CreateIndex
CREATE INDEX "dealer_payouts_city_id_idx" ON "dealer_payouts"("city_id");

-- CreateIndex
CREATE INDEX "franchise_revenues_franchise_id_month_idx" ON "franchise_revenues"("franchise_id", "month");

-- CreateIndex
CREATE INDEX "franchise_revenues_city_id_month_idx" ON "franchise_revenues"("city_id", "month");

-- CreateIndex
CREATE INDEX "franchise_revenues_status_idx" ON "franchise_revenues"("status");

-- CreateIndex
CREATE INDEX "training_modules_city_id_is_active_idx" ON "training_modules"("city_id", "is_active");

-- CreateIndex
CREATE INDEX "training_modules_learning_path_idx" ON "training_modules"("learning_path");

-- CreateIndex
CREATE INDEX "training_progress_agent_id_idx" ON "training_progress"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_progress_agent_id_training_module_id_key" ON "training_progress"("agent_id", "training_module_id");

-- CreateIndex
CREATE INDEX "corporate_audits_franchise_id_idx" ON "corporate_audits"("franchise_id");

-- CreateIndex
CREATE INDEX "corporate_audits_city_id_idx" ON "corporate_audits"("city_id");

-- CreateIndex
CREATE INDEX "corporate_audits_status_idx" ON "corporate_audits"("status");

-- CreateIndex
CREATE INDEX "corporate_audits_scheduled_date_idx" ON "corporate_audits"("scheduled_date");

-- CreateIndex
CREATE INDEX "export_jobs_user_id_idx" ON "export_jobs"("user_id");

-- CreateIndex
CREATE INDEX "export_jobs_status_idx" ON "export_jobs"("status");

-- CreateIndex
CREATE INDEX "feature_usage_events_event_name_created_at_idx" ON "feature_usage_events"("event_name", "created_at");

-- CreateIndex
CREATE INDEX "feature_usage_events_city_id_created_at_idx" ON "feature_usage_events"("city_id", "created_at");

-- CreateIndex
CREATE INDEX "bigquery_sync_logs_table_name_synced_at_idx" ON "bigquery_sync_logs"("table_name", "synced_at");

-- CreateIndex
CREATE INDEX "payments_service_request_id_idx" ON "payments"("service_request_id");

-- CreateIndex
CREATE INDEX "payments_customer_id_idx" ON "payments"("customer_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_razorpay_order_id_idx" ON "payments"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "wire_transfers_payment_id_key" ON "wire_transfers"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "wire_transfers_reference_code_key" ON "wire_transfers"("reference_code");

-- CreateIndex
CREATE INDEX "wire_transfers_reference_code_idx" ON "wire_transfers"("reference_code");

-- CreateIndex
CREATE INDEX "wire_transfers_status_idx" ON "wire_transfers"("status");

-- CreateIndex
CREATE INDEX "wire_transfers_customer_id_idx" ON "wire_transfers"("customer_id");

-- CreateIndex
CREATE INDEX "wire_transfers_sla_deadline_idx" ON "wire_transfers"("sla_deadline");

-- CreateIndex
CREATE INDEX "exchange_rate_snapshots_fetched_at_idx" ON "exchange_rate_snapshots"("fetched_at");

-- CreateIndex
CREATE INDEX "payment_audit_logs_payment_id_idx" ON "payment_audit_logs"("payment_id");

-- CreateIndex
CREATE INDEX "payment_audit_logs_wire_transfer_id_idx" ON "payment_audit_logs"("wire_transfer_id");

-- CreateIndex
CREATE INDEX "payment_audit_logs_performed_by_idx" ON "payment_audit_logs"("performed_by");

-- CreateIndex
CREATE INDEX "poa_documents_customer_id_idx" ON "poa_documents"("customer_id");

-- CreateIndex
CREATE INDEX "poa_documents_service_request_id_idx" ON "poa_documents"("service_request_id");

-- CreateIndex
CREATE INDEX "poa_documents_status_idx" ON "poa_documents"("status");

-- CreateIndex
CREATE INDEX "poa_documents_validity_end_date_idx" ON "poa_documents"("validity_end_date");

-- CreateIndex
CREATE INDEX "poa_execution_steps_poa_document_id_idx" ON "poa_execution_steps"("poa_document_id");

-- CreateIndex
CREATE INDEX "court_hearings_service_request_id_idx" ON "court_hearings"("service_request_id");

-- CreateIndex
CREATE INDEX "court_hearings_hearing_date_idx" ON "court_hearings"("hearing_date");

-- CreateIndex
CREATE INDEX "court_hearings_case_number_idx" ON "court_hearings"("case_number");

-- CreateIndex
CREATE INDEX "court_hearings_city_id_idx" ON "court_hearings"("city_id");

-- CreateIndex
CREATE INDEX "court_orders_service_request_id_idx" ON "court_orders"("service_request_id");

-- CreateIndex
CREATE INDEX "court_orders_case_number_idx" ON "court_orders"("case_number");

-- CreateIndex
CREATE INDEX "court_events_service_request_id_idx" ON "court_events"("service_request_id");

-- CreateIndex
CREATE INDEX "court_events_event_date_idx" ON "court_events"("event_date");

-- CreateIndex
CREATE INDEX "consultations_customer_id_idx" ON "consultations"("customer_id");

-- CreateIndex
CREATE INDEX "consultations_consultant_id_idx" ON "consultations"("consultant_id");

-- CreateIndex
CREATE INDEX "consultations_scheduled_at_utc_idx" ON "consultations"("scheduled_at_utc");

-- CreateIndex
CREATE INDEX "consultations_status_idx" ON "consultations"("status");

-- CreateIndex
CREATE INDEX "consultant_availability_consultant_id_idx" ON "consultant_availability"("consultant_id");

-- CreateIndex
CREATE INDEX "nri_document_submissions_service_request_id_idx" ON "nri_document_submissions"("service_request_id");

-- CreateIndex
CREATE INDEX "nri_document_submissions_customer_id_idx" ON "nri_document_submissions"("customer_id");

-- CreateIndex
CREATE INDEX "nri_document_submissions_courier_tracking_number_idx" ON "nri_document_submissions"("courier_tracking_number");

-- CreateIndex
CREATE UNIQUE INDEX "lawyers_user_id_key" ON "lawyers"("user_id");

-- CreateIndex
CREATE INDEX "lawyers_city_id_idx" ON "lawyers"("city_id");

-- CreateIndex
CREATE INDEX "lawyers_lawyer_status_idx" ON "lawyers"("lawyer_status");

-- CreateIndex
CREATE INDEX "lawyers_state_bar_council_idx" ON "lawyers"("state_bar_council");

-- CreateIndex
CREATE INDEX "lawyer_expertise_expertise_tag_idx" ON "lawyer_expertise"("expertise_tag");

-- CreateIndex
CREATE UNIQUE INDEX "lawyer_expertise_lawyer_id_expertise_tag_key" ON "lawyer_expertise"("lawyer_id", "expertise_tag");

-- CreateIndex
CREATE INDEX "lawyer_expertise_requests_lawyer_id_idx" ON "lawyer_expertise_requests"("lawyer_id");

-- CreateIndex
CREATE INDEX "lawyer_expertise_requests_status_idx" ON "lawyer_expertise_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "legal_cases_case_number_key" ON "legal_cases"("case_number");

-- CreateIndex
CREATE INDEX "legal_cases_lawyer_id_case_status_idx" ON "legal_cases"("lawyer_id", "case_status");

-- CreateIndex
CREATE INDEX "legal_cases_service_request_id_idx" ON "legal_cases"("service_request_id");

-- CreateIndex
CREATE INDEX "legal_cases_city_id_idx" ON "legal_cases"("city_id");

-- CreateIndex
CREATE INDEX "legal_cases_deadline_at_idx" ON "legal_cases"("deadline_at");

-- CreateIndex
CREATE INDEX "legal_case_doc_access_legal_case_id_idx" ON "legal_case_doc_access"("legal_case_id");

-- CreateIndex
CREATE INDEX "legal_case_doc_access_lawyer_id_idx" ON "legal_case_doc_access"("lawyer_id");

-- CreateIndex
CREATE INDEX "legal_case_doc_access_document_id_idx" ON "legal_case_doc_access"("document_id");

-- CreateIndex
CREATE INDEX "legal_case_doc_requests_legal_case_id_idx" ON "legal_case_doc_requests"("legal_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "legal_opinions_legal_case_id_key" ON "legal_opinions"("legal_case_id");

-- CreateIndex
CREATE INDEX "legal_opinions_lawyer_id_idx" ON "legal_opinions"("lawyer_id");

-- CreateIndex
CREATE INDEX "legal_opinions_approval_status_idx" ON "legal_opinions"("approval_status");

-- CreateIndex
CREATE INDEX "lawyer_payouts_lawyer_id_payout_status_idx" ON "lawyer_payouts"("lawyer_id", "payout_status");

-- CreateIndex
CREATE INDEX "lawyer_payouts_payout_batch_id_idx" ON "lawyer_payouts"("payout_batch_id");

-- CreateIndex
CREATE INDEX "lawyer_bank_accounts_lawyer_id_idx" ON "lawyer_bank_accounts"("lawyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "legal_opinion_ratings_legal_case_id_key" ON "legal_opinion_ratings"("legal_case_id");

-- CreateIndex
CREATE INDEX "legal_opinion_ratings_lawyer_id_idx" ON "legal_opinion_ratings"("lawyer_id");

-- CreateIndex
CREATE INDEX "legal_opinion_ratings_customer_id_idx" ON "legal_opinion_ratings"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "builders_user_id_key" ON "builders"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "builders_rera_number_key" ON "builders"("rera_number");

-- CreateIndex
CREATE INDEX "builders_city_id_idx" ON "builders"("city_id");

-- CreateIndex
CREATE INDEX "builders_status_idx" ON "builders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_template_code_key" ON "notification_templates"("template_code");

-- CreateIndex
CREATE INDEX "notification_templates_event_type_language_idx" ON "notification_templates"("event_type", "language");

-- CreateIndex
CREATE INDEX "notification_templates_channel_idx" ON "notification_templates"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_event_type_channel_language_version_key" ON "notification_templates"("event_type", "channel", "language", "version");

-- CreateIndex
CREATE INDEX "notification_log_user_id_template_code_service_instance_id__idx" ON "notification_log"("user_id", "template_code", "service_instance_id", "context_data_hash");

-- CreateIndex
CREATE INDEX "notification_log_user_id_created_at_idx" ON "notification_log"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_log_status_idx" ON "notification_log"("status");

-- CreateIndex
CREATE INDEX "notification_log_channel_status_idx" ON "notification_log"("channel", "status");

-- CreateIndex
CREATE INDEX "notification_log_external_message_id_idx" ON "notification_log"("external_message_id");

-- CreateIndex
CREATE INDEX "failed_notifications_user_id_idx" ON "failed_notifications"("user_id");

-- CreateIndex
CREATE INDEX "failed_notifications_resolved_at_idx" ON "failed_notifications"("resolved_at");

-- CreateIndex
CREATE INDEX "failed_notifications_created_at_idx" ON "failed_notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_token_key" ON "user_devices"("token");

-- CreateIndex
CREATE INDEX "user_devices_user_id_idx" ON "user_devices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_opt_out_user_channel" ON "notification_opt_outs"("user_id", "channel");

-- CreateIndex
CREATE INDEX "sms_cost_log_user_id_idx" ON "sms_cost_log"("user_id");

-- CreateIndex
CREATE INDEX "sms_cost_log_sent_at_idx" ON "sms_cost_log"("sent_at");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_city_id_idx" ON "campaigns"("city_id");

-- CreateIndex
CREATE INDEX "campaigns_scheduled_at_idx" ON "campaigns"("scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_preferences_user_id_key" ON "user_notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "service_communications_service_instance_id_idx" ON "service_communications"("service_instance_id");

-- CreateIndex
CREATE INDEX "service_communications_agent_id_idx" ON "service_communications"("agent_id");

-- CreateIndex
CREATE INDEX "service_communications_customer_id_idx" ON "service_communications"("customer_id");

-- CreateIndex
CREATE INDEX "idx_service_comms_instance_type" ON "service_communications"("service_instance_id", "communication_type");

-- CreateIndex
CREATE INDEX "builder_projects_builder_id_idx" ON "builder_projects"("builder_id");

-- CreateIndex
CREATE INDEX "builder_projects_city_id_idx" ON "builder_projects"("city_id");

-- CreateIndex
CREATE INDEX "project_units_project_id_idx" ON "project_units"("project_id");

-- CreateIndex
CREATE INDEX "project_units_status_idx" ON "project_units"("status");

-- CreateIndex
CREATE UNIQUE INDEX "project_units_project_id_unit_number_key" ON "project_units"("project_id", "unit_number");

-- CreateIndex
CREATE INDEX "bulk_service_requests_project_id_idx" ON "bulk_service_requests"("project_id");

-- CreateIndex
CREATE INDEX "bulk_service_requests_builder_id_idx" ON "bulk_service_requests"("builder_id");

-- CreateIndex
CREATE UNIQUE INDEX "builder_pricing_tiers_project_id_key" ON "builder_pricing_tiers"("project_id");

-- CreateIndex
CREATE INDEX "builder_pricing_tiers_builder_id_idx" ON "builder_pricing_tiers"("builder_id");

-- CreateIndex
CREATE UNIQUE INDEX "builder_contracts_contract_number_key" ON "builder_contracts"("contract_number");

-- CreateIndex
CREATE INDEX "builder_contracts_builder_id_idx" ON "builder_contracts"("builder_id");

-- CreateIndex
CREATE INDEX "builder_contracts_status_idx" ON "builder_contracts"("status");

-- CreateIndex
CREATE INDEX "builder_contracts_valid_to_idx" ON "builder_contracts"("valid_to");

-- CreateIndex
CREATE INDEX "builder_broadcasts_builder_id_idx" ON "builder_broadcasts"("builder_id");

-- CreateIndex
CREATE INDEX "builder_broadcasts_project_id_idx" ON "builder_broadcasts"("project_id");

-- CreateIndex
CREATE INDEX "broadcast_deliveries_broadcast_id_idx" ON "broadcast_deliveries"("broadcast_id");

-- CreateIndex
CREATE INDEX "builder_inbox_messages_builder_id_is_read_idx" ON "builder_inbox_messages"("builder_id", "is_read");

-- CreateIndex
CREATE INDEX "builder_inbox_messages_project_id_idx" ON "builder_inbox_messages"("project_id");

-- CreateIndex
CREATE INDEX "support_agent_messages_service_id_idx" ON "support_agent_messages"("service_id");

-- CreateIndex
CREATE INDEX "support_agent_messages_sender_id_idx" ON "support_agent_messages"("sender_id");

-- CreateIndex
CREATE INDEX "support_agent_messages_recipient_id_idx" ON "support_agent_messages"("recipient_id");

-- CreateIndex
CREATE INDEX "support_agent_messages_service_id_created_at_idx" ON "support_agent_messages"("service_id", "created_at");

-- CreateIndex
CREATE INDEX "support_templates_category_idx" ON "support_templates"("category");

-- CreateIndex
CREATE INDEX "support_template_usage_template_id_idx" ON "support_template_usage"("template_id");

-- CreateIndex
CREATE INDEX "support_template_usage_used_by_idx" ON "support_template_usage"("used_by");

-- CreateIndex
CREATE INDEX "support_reminders_support_agent_id_status_idx" ON "support_reminders"("support_agent_id", "status");

-- CreateIndex
CREATE INDEX "support_reminders_reminder_datetime_idx" ON "support_reminders"("reminder_datetime");

-- CreateIndex
CREATE INDEX "support_reminders_status_idx" ON "support_reminders"("status");

-- CreateIndex
CREATE INDEX "support_case_patterns_service_id_idx" ON "support_case_patterns"("service_id");

-- CreateIndex
CREATE INDEX "support_case_patterns_pattern_category_idx" ON "support_case_patterns"("pattern_category");

-- CreateIndex
CREATE INDEX "support_case_patterns_created_at_idx" ON "support_case_patterns"("created_at");

-- CreateIndex
CREATE INDEX "agent_performance_notes_agent_id_idx" ON "agent_performance_notes"("agent_id");

-- CreateIndex
CREATE INDEX "agent_performance_notes_agent_id_created_at_idx" ON "agent_performance_notes"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "support_escalations_status_idx" ON "support_escalations"("status");

-- CreateIndex
CREATE INDEX "support_escalations_assigned_agent_id_idx" ON "support_escalations"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "support_escalations_first_response_due_idx" ON "support_escalations"("first_response_due");

-- CreateIndex
CREATE INDEX "support_escalations_resolution_due_idx" ON "support_escalations"("resolution_due");

-- CreateIndex
CREATE INDEX "support_escalations_service_id_idx" ON "support_escalations"("service_id");

-- CreateIndex
CREATE INDEX "support_customer_messages_service_id_created_at_idx" ON "support_customer_messages"("service_id", "created_at");

-- CreateIndex
CREATE INDEX "support_customer_messages_recipient_id_read_at_idx" ON "support_customer_messages"("recipient_id", "read_at");

-- CreateIndex
CREATE INDEX "support_agent_metrics_agent_id_idx" ON "support_agent_metrics"("agent_id");

-- CreateIndex
CREATE INDEX "support_agent_metrics_period_start_period_end_idx" ON "support_agent_metrics"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "support_agent_metrics_agent_id_period_start_period_end_key" ON "support_agent_metrics"("agent_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "documents_service_instance_id_idx" ON "documents"("service_instance_id");

-- CreateIndex
CREATE INDEX "documents_doc_type_idx" ON "documents"("doc_type");

-- CreateIndex
CREATE INDEX "documents_uploaded_by_user_id_idx" ON "documents"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "documents_verification_status_idx" ON "documents"("verification_status");

-- CreateIndex
CREATE INDEX "documents_city_id_idx" ON "documents"("city_id");

-- CreateIndex
CREATE INDEX "documents_stakeholder_id_idx" ON "documents"("stakeholder_id");

-- CreateIndex
CREATE INDEX "job_execution_logs_job_name_idx" ON "job_execution_logs"("job_name");

-- CreateIndex
CREATE INDEX "job_execution_logs_document_id_idx" ON "job_execution_logs"("document_id");

-- CreateIndex
CREATE INDEX "ops_review_tasks_type_status_idx" ON "ops_review_tasks"("type", "status");

-- CreateIndex
CREATE INDEX "ops_review_tasks_city_id_idx" ON "ops_review_tasks"("city_id");

-- CreateIndex
CREATE INDEX "ai_accuracy_flags_document_id_idx" ON "ai_accuracy_flags"("document_id");

-- CreateIndex
CREATE INDEX "lawyer_case_assignments_lawyer_id_idx" ON "lawyer_case_assignments"("lawyer_id");

-- CreateIndex
CREATE INDEX "lawyer_case_assignments_service_instance_id_idx" ON "lawyer_case_assignments"("service_instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "lawyer_case_assignments_lawyer_id_service_instance_id_key" ON "lawyer_case_assignments"("lawyer_id", "service_instance_id");

-- CreateIndex
CREATE INDEX "service_stakeholders_service_instance_id_idx" ON "service_stakeholders"("service_instance_id");

-- CreateIndex
CREATE INDEX "service_stakeholders_user_id_idx" ON "service_stakeholders"("user_id");

-- CreateIndex
CREATE INDEX "service_stakeholders_phone_idx" ON "service_stakeholders"("phone");

-- CreateIndex
CREATE INDEX "data_deletion_requests_user_id_idx" ON "data_deletion_requests"("user_id");

-- CreateIndex
CREATE INDEX "data_deletion_requests_status_idx" ON "data_deletion_requests"("status");

-- CreateIndex
CREATE INDEX "deletion_audit_logs_request_id_idx" ON "deletion_audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "deletion_audit_logs_user_id_idx" ON "deletion_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_id_idx" ON "audit_logs"("resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_service_instance_id_idx" ON "audit_logs"("service_instance_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_definitions_code_key" ON "service_definitions"("code");

-- CreateIndex
CREATE INDEX "service_definitions_category_idx" ON "service_definitions"("category");

-- CreateIndex
CREATE INDEX "service_definitions_city_id_idx" ON "service_definitions"("city_id");

-- CreateIndex
CREATE INDEX "service_definitions_is_active_idx" ON "service_definitions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "packages_code_key" ON "packages"("code");

-- CreateIndex
CREATE UNIQUE INDEX "package_items_package_id_service_definition_id_key" ON "package_items"("package_id", "service_definition_id");

-- CreateIndex
CREATE INDEX "service_instances_customer_id_idx" ON "service_instances"("customer_id");

-- CreateIndex
CREATE INDEX "service_instances_assigned_agent_id_idx" ON "service_instances"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "service_instances_state_idx" ON "service_instances"("state");

-- CreateIndex
CREATE INDEX "service_instances_city_id_idx" ON "service_instances"("city_id");

-- CreateIndex
CREATE INDEX "service_instances_sla_deadline_idx" ON "service_instances"("sla_deadline");

-- CreateIndex
CREATE INDEX "service_state_history_service_instance_id_idx" ON "service_state_history"("service_instance_id");

-- CreateIndex
CREATE INDEX "service_state_history_created_at_idx" ON "service_state_history"("created_at");

-- CreateIndex
CREATE INDEX "escalations_service_instance_id_idx" ON "escalations"("service_instance_id");

-- CreateIndex
CREATE INDEX "escalations_status_idx" ON "escalations"("status");

-- CreateIndex
CREATE INDEX "escalations_city_id_idx" ON "escalations"("city_id");

-- CreateIndex
CREATE INDEX "idx_disruptions_status" ON "disruptions"("status");

-- CreateIndex
CREATE INDEX "idx_disruptions_city" ON "disruptions"("city_id");

-- AddForeignKey
ALTER TABLE "city_service_fees" ADD CONSTRAINT "city_service_fees_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_process_overrides" ADD CONSTRAINT "city_process_overrides_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_document_requirements" ADD CONSTRAINT "city_document_requirements_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchise_applications" ADD CONSTRAINT "franchise_applications_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchises" ADD CONSTRAINT "franchises_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_kyc" ADD CONSTRAINT "dealer_kyc_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_link_clicks" ADD CONSTRAINT "dealer_link_clicks_dealer_code_fkey" FOREIGN KEY ("dealer_code") REFERENCES "dealers"("dealer_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_referrals" ADD CONSTRAINT "dealer_referrals_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_commissions" ADD CONSTRAINT "dealer_commissions_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_commissions" ADD CONSTRAINT "dealer_commissions_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "dealer_referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_commissions" ADD CONSTRAINT "dealer_commissions_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "dealer_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_tier_history" ADD CONSTRAINT "dealer_tier_history_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_leaderboard_snapshots" ADD CONSTRAINT "dealer_leaderboard_snapshots_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_badges" ADD CONSTRAINT "dealer_badges_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_bank_accounts" ADD CONSTRAINT "dealer_bank_accounts_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_payouts" ADD CONSTRAINT "dealer_payouts_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_payouts" ADD CONSTRAINT "dealer_payouts_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "dealer_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchise_revenues" ADD CONSTRAINT "franchise_revenues_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "franchises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchise_revenues" ADD CONSTRAINT "franchise_revenues_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_modules" ADD CONSTRAINT "training_modules_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_training_module_id_fkey" FOREIGN KEY ("training_module_id") REFERENCES "training_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_audits" ADD CONSTRAINT "corporate_audits_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "franchises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_audits" ADD CONSTRAINT "corporate_audits_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wire_transfers" ADD CONSTRAINT "wire_transfers_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poa_execution_steps" ADD CONSTRAINT "poa_execution_steps_poa_document_id_fkey" FOREIGN KEY ("poa_document_id") REFERENCES "poa_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_orders" ADD CONSTRAINT "court_orders_hearing_id_fkey" FOREIGN KEY ("hearing_id") REFERENCES "court_hearings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyers" ADD CONSTRAINT "lawyers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_expertise" ADD CONSTRAINT "lawyer_expertise_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "lawyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "lawyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_case_doc_access" ADD CONSTRAINT "legal_case_doc_access_legal_case_id_fkey" FOREIGN KEY ("legal_case_id") REFERENCES "legal_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_case_doc_requests" ADD CONSTRAINT "legal_case_doc_requests_legal_case_id_fkey" FOREIGN KEY ("legal_case_id") REFERENCES "legal_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_opinions" ADD CONSTRAINT "legal_opinions_legal_case_id_fkey" FOREIGN KEY ("legal_case_id") REFERENCES "legal_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_payouts" ADD CONSTRAINT "lawyer_payouts_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "lawyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_payouts" ADD CONSTRAINT "lawyer_payouts_legal_case_id_fkey" FOREIGN KEY ("legal_case_id") REFERENCES "legal_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_bank_accounts" ADD CONSTRAINT "lawyer_bank_accounts_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "lawyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_opinion_ratings" ADD CONSTRAINT "legal_opinion_ratings_legal_case_id_fkey" FOREIGN KEY ("legal_case_id") REFERENCES "legal_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_opinion_ratings" ADD CONSTRAINT "legal_opinion_ratings_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "lawyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builders" ADD CONSTRAINT "builders_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_communications" ADD CONSTRAINT "service_communications_service_instance_id_fkey" FOREIGN KEY ("service_instance_id") REFERENCES "service_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_projects" ADD CONSTRAINT "builder_projects_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_projects" ADD CONSTRAINT "builder_projects_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_units" ADD CONSTRAINT "project_units_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "builder_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_service_requests" ADD CONSTRAINT "bulk_service_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "builder_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_service_requests" ADD CONSTRAINT "bulk_service_requests_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_pricing_tiers" ADD CONSTRAINT "builder_pricing_tiers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "builder_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_pricing_tiers" ADD CONSTRAINT "builder_pricing_tiers_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_contracts" ADD CONSTRAINT "builder_contracts_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_contracts" ADD CONSTRAINT "builder_contracts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "builder_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_broadcasts" ADD CONSTRAINT "builder_broadcasts_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_broadcasts" ADD CONSTRAINT "builder_broadcasts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "builder_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_deliveries" ADD CONSTRAINT "broadcast_deliveries_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "builder_broadcasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_deliveries" ADD CONSTRAINT "broadcast_deliveries_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "project_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_inbox_messages" ADD CONSTRAINT "builder_inbox_messages_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_inbox_messages" ADD CONSTRAINT "builder_inbox_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "builder_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_inbox_messages" ADD CONSTRAINT "builder_inbox_messages_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "project_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_template_usage" ADD CONSTRAINT "support_template_usage_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "support_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_definitions" ADD CONSTRAINT "service_definitions_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_service_definition_id_fkey" FOREIGN KEY ("service_definition_id") REFERENCES "service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_instances" ADD CONSTRAINT "service_instances_service_definition_id_fkey" FOREIGN KEY ("service_definition_id") REFERENCES "service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_instances" ADD CONSTRAINT "service_instances_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_state_history" ADD CONSTRAINT "service_state_history_service_instance_id_fkey" FOREIGN KEY ("service_instance_id") REFERENCES "service_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_service_instance_id_fkey" FOREIGN KEY ("service_instance_id") REFERENCES "service_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disruptions" ADD CONSTRAINT "disruptions_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

