CREATE TABLE `relay_pairs` (
	`id` text PRIMARY KEY NOT NULL,
	`passphrase_hash` text NOT NULL,
	`inbox_a_id` text NOT NULL,
	`inbox_b_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`inbox_a_id`) REFERENCES `inboxes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inbox_b_id`) REFERENCES `inboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `relay_pairs_passphrase_hash_unique` ON `relay_pairs` (`passphrase_hash`);--> statement-breakpoint
CREATE INDEX `idx_relay_pairs_inbox_a` ON `relay_pairs` (`inbox_a_id`);--> statement-breakpoint
CREATE INDEX `idx_relay_pairs_inbox_b` ON `relay_pairs` (`inbox_b_id`);--> statement-breakpoint
ALTER TABLE `inboxes` ADD `is_relay` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `inboxes` ADD `notification_email` text;