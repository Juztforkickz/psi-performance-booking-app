CREATE TABLE `booking_calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`checkout_id` text NOT NULL,
	`booking_reference` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`etag` text,
	`last_error_code` text,
	`last_synced_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "booking_calendar_events_state_check" CHECK("booking_calendar_events"."state" in ('pending', 'confirmed', 'cancelled', 'sync_failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_calendar_events_checkout_id` ON `booking_calendar_events` (`checkout_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_calendar_events_booking_reference` ON `booking_calendar_events` (`booking_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_calendar_events_provider_event_id` ON `booking_calendar_events` (`provider_event_id`);--> statement-breakpoint
CREATE TABLE `booking_checkout_idempotency_keys` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`request_hash` text NOT NULL,
	`checkout_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "booking_checkout_idempotency_key_hash_check" CHECK(length("booking_checkout_idempotency_keys"."key_hash") = 64),
	CONSTRAINT "booking_checkout_idempotency_request_hash_check" CHECK(length("booking_checkout_idempotency_keys"."request_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_checkout_idempotency_checkout_id` ON `booking_checkout_idempotency_keys` (`checkout_id`);--> statement-breakpoint
CREATE TABLE `booking_checkouts` (
	`id` text PRIMARY KEY NOT NULL,
	`public_reference` text NOT NULL,
	`account_id` text,
	`booking_type` text NOT NULL,
	`service_option` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`mobile` text NOT NULL,
	`vehicle_make` text NOT NULL,
	`vehicle_model` text NOT NULL,
	`vehicle_year` integer NOT NULL,
	`registration` text NOT NULL,
	`vin` text DEFAULT '' NOT NULL,
	`preferred_date` text NOT NULL,
	`arrival_window` text DEFAULT 'any' NOT NULL,
	`request_details` text NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`state` text DEFAULT 'awaiting_payment' NOT NULL,
	`deposit_amount_cents` integer DEFAULT 20000 NOT NULL,
	`currency` text DEFAULT 'AUD' NOT NULL,
	`payment_provider` text,
	`provider_checkout_url` text,
	`contact_consent` integer DEFAULT 1 NOT NULL,
	`consent_policy_version` text DEFAULT 'psi-booking-contact-v1' NOT NULL,
	`deposit_terms_accepted` integer DEFAULT 1 NOT NULL,
	`deposit_policy_version` text DEFAULT 'psi-deposit-v1' NOT NULL,
	`deposit_terms_accepted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "booking_checkouts_booking_type_check" CHECK("booking_checkouts"."booking_type" in ('service', 'dyno')),
	CONSTRAINT "booking_checkouts_arrival_window_check" CHECK("booking_checkouts"."arrival_window" in ('morning', 'afternoon', 'any')),
	CONSTRAINT "booking_checkouts_source_check" CHECK("booking_checkouts"."source" in ('web', 'mobile')),
	CONSTRAINT "booking_checkouts_state_check" CHECK("booking_checkouts"."state" in ('awaiting_payment', 'processing', 'paid', 'expired', 'cancelled')),
	CONSTRAINT "booking_checkouts_deposit_amount_check" CHECK("booking_checkouts"."deposit_amount_cents" >= 20000),
	CONSTRAINT "booking_checkouts_currency_check" CHECK("booking_checkouts"."currency" = 'AUD'),
	CONSTRAINT "booking_checkouts_provider_url_check" CHECK("booking_checkouts"."provider_checkout_url" is null or "booking_checkouts"."provider_checkout_url" like 'https://%'),
	CONSTRAINT "booking_checkouts_contact_consent_check" CHECK("booking_checkouts"."contact_consent" = 1),
	CONSTRAINT "booking_checkouts_deposit_terms_check" CHECK("booking_checkouts"."deposit_terms_accepted" = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_checkouts_public_reference` ON `booking_checkouts` (`public_reference`);--> statement-breakpoint
CREATE INDEX `idx_booking_checkouts_account_created` ON `booking_checkouts` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_booking_checkouts_state_expires` ON `booking_checkouts` (`state`,`expires_at`);--> statement-breakpoint
CREATE TABLE `deposit_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`checkout_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_payment_id` text NOT NULL,
	`expected_amount_cents` integer NOT NULL,
	`received_amount_cents` integer DEFAULT 0 NOT NULL,
	`refunded_amount_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'AUD' NOT NULL,
	`status` text DEFAULT 'requires_payment_method' NOT NULL,
	`provider_receipt_url` text,
	`paid_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "deposit_payments_expected_amount_check" CHECK("deposit_payments"."expected_amount_cents" >= 20000),
	CONSTRAINT "deposit_payments_received_amount_check" CHECK("deposit_payments"."received_amount_cents" >= 0),
	CONSTRAINT "deposit_payments_refunded_amount_check" CHECK("deposit_payments"."refunded_amount_cents" >= 0 and "deposit_payments"."refunded_amount_cents" <= "deposit_payments"."received_amount_cents"),
	CONSTRAINT "deposit_payments_currency_check" CHECK("deposit_payments"."currency" = 'AUD'),
	CONSTRAINT "deposit_payments_status_check" CHECK("deposit_payments"."status" in ('requires_payment_method', 'processing', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_deposit_payments_provider_payment` ON `deposit_payments` (`provider`,`provider_payment_id`);--> statement-breakpoint
CREATE INDEX `idx_deposit_payments_checkout_status` ON `deposit_payments` (`checkout_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_deposit_payments_one_successful_checkout` ON `deposit_payments` (`checkout_id`) WHERE "deposit_payments"."status" in ('succeeded', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TABLE `deposit_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_number` text NOT NULL,
	`payment_id` text NOT NULL,
	`document_type` text DEFAULT 'payment_receipt' NOT NULL,
	`supplier_name` text NOT NULL,
	`supplier_abn` text,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`gst_amount_cents` integer,
	`currency` text DEFAULT 'AUD' NOT NULL,
	`provider_receipt_url` text,
	`issued_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "deposit_receipts_document_type_check" CHECK("deposit_receipts"."document_type" in ('payment_receipt', 'tax_invoice')),
	CONSTRAINT "deposit_receipts_amount_check" CHECK("deposit_receipts"."amount_cents" >= 20000),
	CONSTRAINT "deposit_receipts_gst_amount_check" CHECK("deposit_receipts"."gst_amount_cents" is null or ("deposit_receipts"."gst_amount_cents" >= 0 and "deposit_receipts"."gst_amount_cents" <= "deposit_receipts"."amount_cents")),
	CONSTRAINT "deposit_receipts_tax_invoice_identity_check" CHECK("deposit_receipts"."document_type" = 'payment_receipt' or ("deposit_receipts"."supplier_abn" is not null and length(trim("deposit_receipts"."supplier_abn")) > 0 and "deposit_receipts"."gst_amount_cents" is not null)),
	CONSTRAINT "deposit_receipts_currency_check" CHECK("deposit_receipts"."currency" = 'AUD')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_deposit_receipts_receipt_number` ON `deposit_receipts` (`receipt_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_deposit_receipts_payment_id` ON `deposit_receipts` (`payment_id`);--> statement-breakpoint
CREATE TABLE `integration_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`provider_result_id` text,
	`last_error_code` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sent_at` text,
	CONSTRAINT "integration_outbox_state_check" CHECK("integration_outbox"."state" in ('pending', 'processing', 'sent', 'failed', 'dead_letter')),
	CONSTRAINT "integration_outbox_attempt_count_check" CHECK("integration_outbox"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_integration_outbox_dedupe_key` ON `integration_outbox` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_integration_outbox_state_next_attempt` ON `integration_outbox` (`state`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `payment_webhook_events` (
	`provider` text NOT NULL,
	`event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_hash` text NOT NULL,
	`state` text DEFAULT 'received' NOT NULL,
	`last_error_code` text,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`processed_at` text,
	PRIMARY KEY(`provider`, `event_id`),
	CONSTRAINT "payment_webhook_events_payload_hash_check" CHECK(length("payment_webhook_events"."payload_hash") = 64),
	CONSTRAINT "payment_webhook_events_state_check" CHECK("payment_webhook_events"."state" in ('received', 'processed', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `idx_payment_webhook_events_state_received` ON `payment_webhook_events` (`state`,`received_at`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `checkout_id` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `deposit_payment_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bookings_checkout_id` ON `bookings` (`checkout_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bookings_deposit_payment_id` ON `bookings` (`deposit_payment_id`);