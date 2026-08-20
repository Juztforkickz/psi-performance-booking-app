CREATE TABLE `admin_action_idempotency_keys` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`request_hash` text NOT NULL,
	`booking_request_id` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "admin_action_idempotency_key_hash_check" CHECK(length("admin_action_idempotency_keys"."key_hash") = 64),
	CONSTRAINT "admin_action_idempotency_request_hash_check" CHECK(length("admin_action_idempotency_keys"."request_hash") = 64),
	CONSTRAINT "admin_action_idempotency_response_json_check" CHECK(json_valid("admin_action_idempotency_keys"."response_json"))
);
--> statement-breakpoint
CREATE INDEX `idx_admin_action_idempotency_request` ON `admin_action_idempotency_keys` (`booking_request_id`);--> statement-breakpoint
CREATE TABLE `appointment_reminder_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_request_id` text NOT NULL,
	`reminder_kind` text NOT NULL,
	`due_at` text NOT NULL,
	`state` text DEFAULT 'scheduled' NOT NULL,
	`schedule_version` integer DEFAULT 1 NOT NULL,
	`dispatched_at` text,
	`cancelled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "appointment_reminders_kind_check" CHECK("appointment_reminder_jobs"."reminder_kind" in ('seven_days', 'twenty_four_hours')),
	CONSTRAINT "appointment_reminders_state_check" CHECK("appointment_reminder_jobs"."state" in ('scheduled', 'processing', 'sent', 'cancelled', 'failed')),
	CONSTRAINT "appointment_reminders_schedule_version_check" CHECK("appointment_reminder_jobs"."schedule_version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_appointment_reminders_request_kind_version` ON `appointment_reminder_jobs` (`booking_request_id`,`reminder_kind`,`schedule_version`);--> statement-breakpoint
CREATE INDEX `idx_appointment_reminders_state_due` ON `appointment_reminder_jobs` (`state`,`due_at`);--> statement-breakpoint
CREATE TABLE `booking_request_calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_request_id` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`calendar_id` text NOT NULL,
	`provider_event_id` text,
	`last_error_code` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "booking_request_calendar_state_check" CHECK("booking_request_calendar_events"."state" in ('queued', 'created', 'cancelled', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_request_calendar_request_id` ON `booking_request_calendar_events` (`booking_request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_request_calendar_provider_event` ON `booking_request_calendar_events` (`calendar_id`,`provider_event_id`);--> statement-breakpoint
CREATE TABLE `booking_request_checkouts` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_request_id` text NOT NULL,
	`state` text DEFAULT 'provider_pending' NOT NULL,
	`deposit_amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'AUD' NOT NULL,
	`payment_provider` text,
	`provider_checkout_id` text,
	`provider_checkout_url` text,
	`calendar_id_snapshot` text,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "booking_request_checkouts_state_check" CHECK("booking_request_checkouts"."state" in ('provider_pending', 'awaiting_payment', 'processing', 'cancellation_pending', 'paid', 'expired', 'cancelled')),
	CONSTRAINT "booking_request_checkouts_amount_check" CHECK("booking_request_checkouts"."deposit_amount_cents" in (10000, 30000)),
	CONSTRAINT "booking_request_checkouts_currency_check" CHECK("booking_request_checkouts"."currency" = 'AUD'),
	CONSTRAINT "booking_request_checkouts_url_check" CHECK("booking_request_checkouts"."provider_checkout_url" is null or "booking_request_checkouts"."provider_checkout_url" like 'https://%')
);
--> statement-breakpoint
CREATE INDEX `idx_booking_request_checkouts_request_id` ON `booking_request_checkouts` (`booking_request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_request_checkouts_provider_checkout` ON `booking_request_checkouts` (`payment_provider`,`provider_checkout_id`);--> statement-breakpoint
CREATE TABLE `booking_request_idempotency_keys` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`request_hash` text NOT NULL,
	`booking_request_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "booking_request_idempotency_key_hash_check" CHECK(length("booking_request_idempotency_keys"."key_hash") = 64),
	CONSTRAINT "booking_request_idempotency_request_hash_check" CHECK(length("booking_request_idempotency_keys"."request_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_request_idempotency_request_id` ON `booking_request_idempotency_keys` (`booking_request_id`);--> statement-breakpoint
CREATE TABLE `booking_request_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_request_id` text NOT NULL,
	`checkout_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_payment_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'AUD' NOT NULL,
	`status` text DEFAULT 'verified' NOT NULL,
	`provider_receipt_url` text,
	`verified_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`paid_at` text NOT NULL,
	CONSTRAINT "booking_request_payments_amount_check" CHECK("booking_request_payments"."amount_cents" in (10000, 30000)),
	CONSTRAINT "booking_request_payments_currency_check" CHECK("booking_request_payments"."currency" = 'AUD'),
	CONSTRAINT "booking_request_payments_status_check" CHECK("booking_request_payments"."status" = 'verified')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_request_payments_request_id` ON `booking_request_payments` (`booking_request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_request_payments_checkout_id` ON `booking_request_payments` (`checkout_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_request_payments_provider_payment` ON `booking_request_payments` (`provider`,`provider_payment_id`);--> statement-breakpoint
CREATE TABLE `booking_request_transitions` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_request_id` text NOT NULL,
	`from_state` text,
	`to_state` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "booking_request_transitions_actor_check" CHECK("booking_request_transitions"."actor" in ('customer', 'staff', 'payment_webhook', 'system'))
);
--> statement-breakpoint
CREATE INDEX `idx_booking_request_transitions_request_created` ON `booking_request_transitions` (`booking_request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `booking_request_action_claims` (
	`booking_request_id` text NOT NULL,
	`expected_version` integer NOT NULL,
	`action_key_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`booking_request_id`, `expected_version`),
	CONSTRAINT "booking_request_action_claims_version_check" CHECK("booking_request_action_claims"."expected_version" >= 0),
	CONSTRAINT "booking_request_action_claims_key_hash_check" CHECK(length("booking_request_action_claims"."action_key_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_request_action_claims_key` ON `booking_request_action_claims` (`action_key_hash`);--> statement-breakpoint
CREATE TABLE `booking_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`public_reference` text NOT NULL,
	`customer_profile_id` text,
	`vehicle_id` text,
	`first_name_snapshot` text NOT NULL,
	`last_name_snapshot` text NOT NULL,
	`email_snapshot` text NOT NULL,
	`mobile_snapshot` text NOT NULL,
	`vehicle_make_snapshot` text NOT NULL,
	`vehicle_model_snapshot` text NOT NULL,
	`vehicle_year_snapshot` integer NOT NULL,
	`registration_snapshot` text NOT NULL,
	`vin_snapshot` text DEFAULT '' NOT NULL,
	`booking_type` text NOT NULL,
	`service_option` text NOT NULL,
	`appointment_preference_mode` text NOT NULL,
	`preferred_date` text,
	`arrival_arrangement` text NOT NULL,
	`after_hours_collection` integer DEFAULT 0 NOT NULL,
	`notify_earlier_availability` integer DEFAULT 0 NOT NULL,
	`service_reminder_consent` integer DEFAULT 0 NOT NULL,
	`request_details` text NOT NULL,
	`setup_confidence` text,
	`tuning_details_json` text,
	`source` text NOT NULL,
	`contact_consent` integer NOT NULL,
	`booking_terms_accepted` integer NOT NULL,
	`booking_policy_version` text NOT NULL,
	`deposit_policy_version` text NOT NULL,
	`deposit_amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'AUD' NOT NULL,
	`state` text DEFAULT 'pending_staff_review' NOT NULL,
	`state_version` integer DEFAULT 0 NOT NULL,
	`proposed_date` text,
	`confirmed_date` text,
	`confirmed_arrival_arrangement` text,
	`confirmed_allocation_mode` text,
	`confirmed_start_time` text,
	`confirmed_end_time` text,
	`staff_notes` text DEFAULT '' NOT NULL,
	`checkout_id` text,
	`deposit_payment_id` text,
	`completed_at` text,
	`cancelled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "booking_requests_booking_type_check" CHECK("booking_requests"."booking_type" in ('service', 'dyno')),
	CONSTRAINT "booking_requests_service_option_check" CHECK(("booking_requests"."booking_type" = 'service' and "booking_requests"."service_option" = 'service_report') or ("booking_requests"."booking_type" = 'dyno' and "booking_requests"."service_option" = 'dyno_tuning')),
	CONSTRAINT "booking_requests_preference_check" CHECK(("booking_requests"."appointment_preference_mode" = 'specific' and "booking_requests"."preferred_date" is not null) or ("booking_requests"."appointment_preference_mode" = 'flexible' and "booking_requests"."preferred_date" is null)),
	CONSTRAINT "booking_requests_arrival_arrangement_check" CHECK("booking_requests"."arrival_arrangement" in ('business_hours', 'before_hours_drop_off', 'after_hours_drop_off', 'flexible')),
	CONSTRAINT "booking_requests_confirmed_arrangement_check" CHECK("booking_requests"."confirmed_arrival_arrangement" is null or "booking_requests"."confirmed_arrival_arrangement" in ('business_hours', 'before_hours_drop_off', 'after_hours_drop_off', 'flexible')),
	CONSTRAINT "booking_requests_confirmed_allocation_check" CHECK(("booking_requests"."confirmed_allocation_mode" is null and "booking_requests"."confirmed_start_time" is null and "booking_requests"."confirmed_end_time" is null) or ("booking_requests"."confirmed_allocation_mode" = 'all_day' and "booking_requests"."confirmed_start_time" is null and "booking_requests"."confirmed_end_time" is null) or ("booking_requests"."confirmed_allocation_mode" = 'timed' and "booking_requests"."confirmed_start_time" glob '[0-2][0-9]:[0-5][0-9]' and substr("booking_requests"."confirmed_start_time", 1, 2) between '00' and '23' and "booking_requests"."confirmed_end_time" glob '[0-2][0-9]:[0-5][0-9]' and substr("booking_requests"."confirmed_end_time", 1, 2) between '00' and '23' and "booking_requests"."confirmed_start_time" < "booking_requests"."confirmed_end_time")),
	CONSTRAINT "booking_requests_setup_confidence_check" CHECK(("booking_requests"."booking_type" = 'service' and "booking_requests"."setup_confidence" is null and "booking_requests"."tuning_details_json" is null) or ("booking_requests"."booking_type" = 'dyno' and "booking_requests"."setup_confidence" in ('known', 'psi_inspection'))),
	CONSTRAINT "booking_requests_tuning_details_json_check" CHECK("booking_requests"."tuning_details_json" is null or json_valid("booking_requests"."tuning_details_json")),
	CONSTRAINT "booking_requests_source_check" CHECK("booking_requests"."source" in ('web', 'mobile')),
	CONSTRAINT "booking_requests_boolean_flags_check" CHECK("booking_requests"."after_hours_collection" in (0, 1) and "booking_requests"."notify_earlier_availability" in (0, 1) and "booking_requests"."service_reminder_consent" in (0, 1)),
	CONSTRAINT "booking_requests_contact_consent_check" CHECK("booking_requests"."contact_consent" = 1),
	CONSTRAINT "booking_requests_booking_terms_check" CHECK("booking_requests"."booking_terms_accepted" = 1),
	CONSTRAINT "booking_requests_deposit_amount_check" CHECK(("booking_requests"."booking_type" = 'service' and "booking_requests"."deposit_amount_cents" = 10000) or ("booking_requests"."booking_type" = 'dyno' and "booking_requests"."deposit_amount_cents" = 30000)),
	CONSTRAINT "booking_requests_currency_check" CHECK("booking_requests"."currency" = 'AUD'),
	CONSTRAINT "booking_requests_state_check" CHECK("booking_requests"."state" in ('pending_staff_review', 'date_proposed', 'date_approved', 'awaiting_deposit', 'confirmed', 'completed', 'cancelled')),
	CONSTRAINT "booking_requests_state_version_check" CHECK("booking_requests"."state_version" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_requests_public_reference` ON `booking_requests` (`public_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_requests_checkout_id` ON `booking_requests` (`checkout_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_requests_deposit_payment_id` ON `booking_requests` (`deposit_payment_id`);--> statement-breakpoint
CREATE INDEX `idx_booking_requests_state_created` ON `booking_requests` (`state`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_booking_requests_customer_created` ON `booking_requests` (`customer_profile_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_booking_requests_vehicle_created` ON `booking_requests` (`vehicle_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_booking_requests_confirmed_date` ON `booking_requests` (`confirmed_date`);--> statement-breakpoint
CREATE INDEX `idx_booking_requests_earlier_candidate` ON `booking_requests` (`notify_earlier_availability`,`state`,`preferred_date`);--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`account_user_id` text,
	`account_state` text DEFAULT 'unclaimed' NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`mobile` text NOT NULL,
	`contact_consent` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "customer_profiles_account_state_check" CHECK("customer_profiles"."account_state" in ('unclaimed', 'active', 'disabled')),
	CONSTRAINT "customer_profiles_contact_consent_check" CHECK("customer_profiles"."contact_consent" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_profiles_email` ON `customer_profiles` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_profiles_account_user_id` ON `customer_profiles` (`account_user_id`);--> statement-breakpoint
CREATE INDEX `idx_customer_profiles_mobile` ON `customer_profiles` (`mobile`);--> statement-breakpoint
CREATE TABLE `customer_vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_profile_id` text NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`year` integer NOT NULL,
	`registration` text NOT NULL,
	`vin` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "customer_vehicles_year_check" CHECK("customer_vehicles"."year" between 1900 and 2200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_vehicles_profile_registration` ON `customer_vehicles` (`customer_profile_id`,`registration`);--> statement-breakpoint
CREATE INDEX `idx_customer_vehicles_profile_updated` ON `customer_vehicles` (`customer_profile_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `service_reminder_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_request_id` text NOT NULL,
	`customer_profile_id` text,
	`interval_months` integer NOT NULL,
	`due_at` text NOT NULL,
	`state` text DEFAULT 'scheduled' NOT NULL,
	`unsubscribe_token_hash` text NOT NULL,
	`recipient_email_hash` text NOT NULL,
	`dispatched_at` text,
	`unsubscribed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "service_reminder_jobs_interval_check" CHECK("service_reminder_jobs"."interval_months" in (6, 12)),
	CONSTRAINT "service_reminder_jobs_state_check" CHECK("service_reminder_jobs"."state" in ('scheduled', 'processing', 'sent', 'cancelled', 'unsubscribed', 'failed')),
	CONSTRAINT "service_reminder_jobs_unsubscribe_hash_check" CHECK(length("service_reminder_jobs"."unsubscribe_token_hash") = 64),
	CONSTRAINT "service_reminder_jobs_recipient_email_hash_check" CHECK(length("service_reminder_jobs"."recipient_email_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_service_reminder_jobs_request_interval` ON `service_reminder_jobs` (`booking_request_id`,`interval_months`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_service_reminder_jobs_unsubscribe_hash` ON `service_reminder_jobs` (`unsubscribe_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_service_reminder_jobs_state_due` ON `service_reminder_jobs` (`state`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_service_reminder_jobs_customer_state` ON `service_reminder_jobs` (`customer_profile_id`,`state`);--> statement-breakpoint
CREATE TABLE `service_reminder_suppressions` (
	`recipient_email_hash` text PRIMARY KEY NOT NULL,
	`reason` text DEFAULT 'customer_unsubscribe' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "service_reminder_suppressions_email_hash_check" CHECK(length("service_reminder_suppressions"."recipient_email_hash") = 64),
	CONSTRAINT "service_reminder_suppressions_reason_check" CHECK("service_reminder_suppressions"."reason" in ('customer_unsubscribe', 'staff_suppression'))
);--> statement-breakpoint
ALTER TABLE `integration_outbox`
ADD COLUMN `payload_json` text
CHECK (`payload_json` is null or json_valid(`payload_json`));
