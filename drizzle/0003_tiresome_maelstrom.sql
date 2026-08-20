ALTER TABLE `booking_checkouts`
ADD COLUMN `tuning_details_json` text
CHECK (`tuning_details_json` IS NULL OR json_valid(`tuning_details_json`));--> statement-breakpoint
ALTER TABLE `bookings`
ADD COLUMN `tuning_details_json` text
CHECK (`tuning_details_json` IS NULL OR json_valid(`tuning_details_json`));
