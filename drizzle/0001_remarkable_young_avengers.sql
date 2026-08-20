CREATE TABLE `booking_idempotency_keys` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`request_hash` text NOT NULL,
	`public_reference` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "booking_idempotency_key_hash_check" CHECK(length("booking_idempotency_keys"."key_hash") = 64),
	CONSTRAINT "booking_idempotency_request_hash_check" CHECK(length("booking_idempotency_keys"."request_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_idempotency_public_reference` ON `booking_idempotency_keys` (`public_reference`);--> statement-breakpoint
CREATE TABLE `booking_rate_limits` (
	`ip_hash` text NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`ip_hash`, `window_start`),
	CONSTRAINT "booking_rate_limits_ip_hash_check" CHECK(length("booking_rate_limits"."ip_hash") = 64),
	CONSTRAINT "booking_rate_limits_request_count_check" CHECK("booking_rate_limits"."request_count" >= 1)
);
--> statement-breakpoint
CREATE INDEX `idx_booking_rate_limits_window_start` ON `booking_rate_limits` (`window_start`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `consent_policy_version` text DEFAULT 'psi-booking-contact-v1' NOT NULL;