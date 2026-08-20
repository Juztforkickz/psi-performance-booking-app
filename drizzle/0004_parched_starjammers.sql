PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_booking_checkouts` (
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
	`tuning_details_json` text,
	`source` text DEFAULT 'web' NOT NULL,
	`state` text DEFAULT 'awaiting_payment' NOT NULL,
	`deposit_amount_cents` integer DEFAULT 10000 NOT NULL,
	`currency` text DEFAULT 'AUD' NOT NULL,
	`payment_provider` text,
	`provider_checkout_url` text,
	`contact_consent` integer DEFAULT 1 NOT NULL,
	`consent_policy_version` text DEFAULT 'psi-booking-contact-v1' NOT NULL,
	`deposit_terms_accepted` integer DEFAULT 1 NOT NULL,
	`deposit_policy_version` text DEFAULT 'psi-deposit-v2' NOT NULL,
	`deposit_terms_accepted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "booking_checkouts_booking_type_check" CHECK("__new_booking_checkouts"."booking_type" in ('service', 'dyno')),
	CONSTRAINT "booking_checkouts_arrival_window_check" CHECK("__new_booking_checkouts"."arrival_window" in ('morning', 'afternoon', 'any')),
	CONSTRAINT "booking_checkouts_source_check" CHECK("__new_booking_checkouts"."source" in ('web', 'mobile')),
	CONSTRAINT "booking_checkouts_state_check" CHECK("__new_booking_checkouts"."state" in ('awaiting_payment', 'processing', 'paid', 'expired', 'cancelled')),
	CONSTRAINT "booking_checkouts_tuning_details_json_check" CHECK("__new_booking_checkouts"."tuning_details_json" is null or json_valid("__new_booking_checkouts"."tuning_details_json")),
	CONSTRAINT "booking_checkouts_deposit_amount_check" CHECK("__new_booking_checkouts"."deposit_amount_cents" >= 10000),
	CONSTRAINT "booking_checkouts_currency_check" CHECK("__new_booking_checkouts"."currency" = 'AUD'),
	CONSTRAINT "booking_checkouts_provider_url_check" CHECK("__new_booking_checkouts"."provider_checkout_url" is null or "__new_booking_checkouts"."provider_checkout_url" like 'https://%'),
	CONSTRAINT "booking_checkouts_contact_consent_check" CHECK("__new_booking_checkouts"."contact_consent" = 1),
	CONSTRAINT "booking_checkouts_deposit_terms_check" CHECK("__new_booking_checkouts"."deposit_terms_accepted" = 1)
);
--> statement-breakpoint
INSERT INTO `__new_booking_checkouts`("id", "public_reference", "account_id", "booking_type", "service_option", "first_name", "last_name", "email", "mobile", "vehicle_make", "vehicle_model", "vehicle_year", "registration", "vin", "preferred_date", "arrival_window", "request_details", "tuning_details_json", "source", "state", "deposit_amount_cents", "currency", "payment_provider", "provider_checkout_url", "contact_consent", "consent_policy_version", "deposit_terms_accepted", "deposit_policy_version", "deposit_terms_accepted_at", "expires_at", "created_at", "updated_at") SELECT "id", "public_reference", "account_id", "booking_type", "service_option", "first_name", "last_name", "email", "mobile", "vehicle_make", "vehicle_model", "vehicle_year", "registration", "vin", "preferred_date", "arrival_window", "request_details", "tuning_details_json", "source", "state", "deposit_amount_cents", "currency", "payment_provider", "provider_checkout_url", "contact_consent", "consent_policy_version", "deposit_terms_accepted", "deposit_policy_version", "deposit_terms_accepted_at", "expires_at", "created_at", "updated_at" FROM `booking_checkouts`;--> statement-breakpoint
DROP TABLE `booking_checkouts`;--> statement-breakpoint
ALTER TABLE `__new_booking_checkouts` RENAME TO `booking_checkouts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_checkouts_public_reference` ON `booking_checkouts` (`public_reference`);--> statement-breakpoint
CREATE INDEX `idx_booking_checkouts_account_created` ON `booking_checkouts` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_booking_checkouts_state_expires` ON `booking_checkouts` (`state`,`expires_at`);--> statement-breakpoint
CREATE TABLE `__new_deposit_payments` (
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
	CONSTRAINT "deposit_payments_expected_amount_check" CHECK("__new_deposit_payments"."expected_amount_cents" >= 10000),
	CONSTRAINT "deposit_payments_received_amount_check" CHECK("__new_deposit_payments"."received_amount_cents" >= 0),
	CONSTRAINT "deposit_payments_refunded_amount_check" CHECK("__new_deposit_payments"."refunded_amount_cents" >= 0 and "__new_deposit_payments"."refunded_amount_cents" <= "__new_deposit_payments"."received_amount_cents"),
	CONSTRAINT "deposit_payments_currency_check" CHECK("__new_deposit_payments"."currency" = 'AUD'),
	CONSTRAINT "deposit_payments_status_check" CHECK("__new_deposit_payments"."status" in ('requires_payment_method', 'processing', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded'))
);
--> statement-breakpoint
INSERT INTO `__new_deposit_payments`("id", "checkout_id", "provider", "provider_payment_id", "expected_amount_cents", "received_amount_cents", "refunded_amount_cents", "currency", "status", "provider_receipt_url", "paid_at", "created_at", "updated_at") SELECT "id", "checkout_id", "provider", "provider_payment_id", "expected_amount_cents", "received_amount_cents", "refunded_amount_cents", "currency", "status", "provider_receipt_url", "paid_at", "created_at", "updated_at" FROM `deposit_payments`;--> statement-breakpoint
DROP TABLE `deposit_payments`;--> statement-breakpoint
ALTER TABLE `__new_deposit_payments` RENAME TO `deposit_payments`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_deposit_payments_provider_payment` ON `deposit_payments` (`provider`,`provider_payment_id`);--> statement-breakpoint
CREATE INDEX `idx_deposit_payments_checkout_status` ON `deposit_payments` (`checkout_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_deposit_payments_one_successful_checkout` ON `deposit_payments` (`checkout_id`) WHERE "deposit_payments"."status" in ('succeeded', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TABLE `__new_deposit_receipts` (
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
	CONSTRAINT "deposit_receipts_document_type_check" CHECK("__new_deposit_receipts"."document_type" in ('payment_receipt', 'tax_invoice')),
	CONSTRAINT "deposit_receipts_amount_check" CHECK("__new_deposit_receipts"."amount_cents" >= 10000),
	CONSTRAINT "deposit_receipts_gst_amount_check" CHECK("__new_deposit_receipts"."gst_amount_cents" is null or ("__new_deposit_receipts"."gst_amount_cents" >= 0 and "__new_deposit_receipts"."gst_amount_cents" <= "__new_deposit_receipts"."amount_cents")),
	CONSTRAINT "deposit_receipts_tax_invoice_identity_check" CHECK("__new_deposit_receipts"."document_type" = 'payment_receipt' or ("__new_deposit_receipts"."supplier_abn" is not null and length(trim("__new_deposit_receipts"."supplier_abn")) > 0 and "__new_deposit_receipts"."gst_amount_cents" is not null)),
	CONSTRAINT "deposit_receipts_currency_check" CHECK("__new_deposit_receipts"."currency" = 'AUD')
);
--> statement-breakpoint
INSERT INTO `__new_deposit_receipts`("id", "receipt_number", "payment_id", "document_type", "supplier_name", "supplier_abn", "customer_name", "customer_email", "description", "amount_cents", "gst_amount_cents", "currency", "provider_receipt_url", "issued_at") SELECT "id", "receipt_number", "payment_id", "document_type", "supplier_name", "supplier_abn", "customer_name", "customer_email", "description", "amount_cents", "gst_amount_cents", "currency", "provider_receipt_url", "issued_at" FROM `deposit_receipts`;--> statement-breakpoint
DROP TABLE `deposit_receipts`;--> statement-breakpoint
ALTER TABLE `__new_deposit_receipts` RENAME TO `deposit_receipts`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_deposit_receipts_receipt_number` ON `deposit_receipts` (`receipt_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_deposit_receipts_payment_id` ON `deposit_receipts` (`payment_id`);