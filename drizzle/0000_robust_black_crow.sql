CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_reference` text NOT NULL,
	`booking_type` text NOT NULL,
	`service_option` text NOT NULL,
	`customer_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`vehicle_make` text NOT NULL,
	`vehicle_model` text NOT NULL,
	`vehicle_year` integer NOT NULL,
	`registration` text DEFAULT '' NOT NULL,
	`vin` text DEFAULT '' NOT NULL,
	`preferred_date` text NOT NULL,
	`arrival_window` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`consent` integer DEFAULT 1 NOT NULL,
	`consented_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "bookings_booking_type_check" CHECK("bookings"."booking_type" in ('service', 'dyno')),
	CONSTRAINT "bookings_arrival_window_check" CHECK("bookings"."arrival_window" in ('morning', 'afternoon', 'any')),
	CONSTRAINT "bookings_source_check" CHECK("bookings"."source" in ('web', 'mobile')),
	CONSTRAINT "bookings_status_check" CHECK("bookings"."status" in ('requested', 'confirmed', 'completed', 'cancelled')),
	CONSTRAINT "bookings_consent_check" CHECK("bookings"."consent" = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bookings_public_reference` ON `bookings` (`public_reference`);