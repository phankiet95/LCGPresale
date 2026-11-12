CREATE TABLE `action_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`opp_id` integer NOT NULL,
	`task` text NOT NULL,
	`owner_id` integer,
	`start_date` text,
	`due_date` text,
	`status` text DEFAULT 'Open' NOT NULL,
	`progress` integer,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opp_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_action_progress" CHECK(progress IS NULL OR (progress BETWEEN 0 AND 100))
);
--> statement-breakpoint
CREATE INDEX `ix_action_items_opp` ON `action_items` (`opp_id`);--> statement-breakpoint
CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`opp_id` integer NOT NULL,
	`activity_date` text NOT NULL,
	`type` text NOT NULL,
	`is_customer_facing` integer DEFAULT false NOT NULL,
	`content` text NOT NULL,
	`next_action` text,
	`action_owner_id` integer,
	`due_date` text,
	`source` text DEFAULT 'app' NOT NULL,
	`created_by` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opp_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`action_owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_act_opp_date` ON `activities` (`opp_id`,`activity_date`,`created_at`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity` text NOT NULL,
	`entity_id` integer NOT NULL,
	`field` text,
	`old_value` text,
	`new_value` text,
	`changed_by` integer,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_audit_entity` ON `audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE TABLE `countries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`market_code` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_countries_market_name` ON `countries` (`market_code`,`name`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_ja` text,
	`normalized_name` text NOT NULL,
	`industry` text,
	`is_strategic` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_normalized_name_unique` ON `customers` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`fiscal_year` integer NOT NULL,
	`currency` text NOT NULL,
	`rate_to_usd` real NOT NULL,
	PRIMARY KEY(`fiscal_year`, `currency`),
	CONSTRAINT "chk_fx_positive" CHECK(rate_to_usd > 0)
);
--> statement-breakpoint
CREATE TABLE `lookups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`value` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_lookups_cat_value` ON `lookups` (`category`,`value`);--> statement-breakpoint
CREATE TABLE `markets` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `opp_code_seq` (
	`year` integer PRIMARY KEY NOT NULL,
	`last_no` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`opp_code` text NOT NULL,
	`name` text NOT NULL,
	`customer_id` integer NOT NULL,
	`industry` text,
	`market_code` text NOT NULL,
	`country_id` integer,
	`partner_id` integer NOT NULL,
	`secondary_partner` text,
	`solution` text,
	`is_laida` integer DEFAULT false NOT NULL,
	`deal_type` text,
	`sales_owner_id` integer NOT NULL,
	`vi_owner_id` integer,
	`coordinator_id` integer,
	`amount` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`win_rate_override` integer,
	`win_rate_reason` text,
	`priority` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`stage` text DEFAULT 'O' NOT NULL,
	`stage_changed_at` text NOT NULL,
	`status_changed_at` text NOT NULL,
	`latest_activity` text,
	`latest_update_date` text,
	`last_contact_date` text,
	`next_action` text,
	`action_owner_id` integer,
	`due_date` text,
	`expected_close_date` text NOT NULL,
	`closed_at` text,
	`pending_reason` text,
	`lost_reason` text,
	`blocking_issue` text,
	`support_needed` text,
	`background_note` text,
	`is_focus_pinned` integer DEFAULT false NOT NULL,
	`verified_at` text,
	`verified_by` integer,
	`legacy_ref` text,
	`merged_into_id` integer,
	`import_needs_confirm` text,
	`created_at` text NOT NULL,
	`created_by` integer,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sales_owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vi_owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`coordinator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`action_owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_opp_stage" CHECK(stage IN ('O', 'D', 'C', 'B', 'A', 'W', 'L')),
	CONSTRAINT "chk_opp_status" CHECK(status IN ('Active', 'On Hold', 'Closed')),
	CONSTRAINT "chk_opp_amount" CHECK(amount >= 0),
	CONSTRAINT "chk_opp_win_rate" CHECK(win_rate_override IS NULL OR (win_rate_override BETWEEN 0 AND 100)),
	CONSTRAINT "chk_closed_consistency" CHECK((stage IN ('W','L')) = (status = 'Closed')),
	CONSTRAINT "chk_closed_at" CHECK(stage NOT IN ('W','L') OR closed_at IS NOT NULL),
	CONSTRAINT "chk_lost_reason" CHECK(stage <> 'L' OR lost_reason IS NOT NULL),
	CONSTRAINT "chk_won_amount" CHECK(stage <> 'W' OR amount > 0),
	CONSTRAINT "chk_pending" CHECK(status <> 'On Hold' OR pending_reason IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunities_opp_code_unique` ON `opportunities` (`opp_code`);--> statement-breakpoint
CREATE INDEX `ix_opp_market` ON `opportunities` (`market_code`);--> statement-breakpoint
CREATE INDEX `ix_opp_partner` ON `opportunities` (`partner_id`);--> statement-breakpoint
CREATE INDEX `ix_opp_owner` ON `opportunities` (`sales_owner_id`);--> statement-breakpoint
CREATE INDEX `ix_opp_stage` ON `opportunities` (`stage`,`status`);--> statement-breakpoint
CREATE INDEX `ix_opp_customer` ON `opportunities` (`customer_id`);--> statement-breakpoint
CREATE TABLE `partners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partners_name_unique` ON `partners` (`name`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stage_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`opp_id` integer NOT NULL,
	`from_stage` text,
	`to_stage` text,
	`from_status` text,
	`to_status` text,
	`reason` text,
	`changed_by` integer,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`opp_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_stage_history_opp` ON `stage_history` (`opp_id`);--> statement-breakpoint
CREATE TABLE `user_markets` (
	`user_id` integer NOT NULL,
	`market_code` text NOT NULL,
	PRIMARY KEY(`user_id`, `market_code`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account` text NOT NULL,
	`email` text,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'sales' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`password_hash` text,
	`must_change_password` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "chk_users_role" CHECK(role IN ('admin', 'management', 'market_lead', 'sales', 'viewer'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_users_account` ON `users` (lower("account"));--> statement-breakpoint
CREATE UNIQUE INDEX `ux_users_email` ON `users` (lower("email"));--> statement-breakpoint
CREATE TABLE `weekly_recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`market_code` text,
	`finding` text NOT NULL,
	`impact` text,
	`recommendation` text,
	`owner_id` integer,
	`target_date` text,
	`created_by` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`market_code`) REFERENCES `markets`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `weekly_snapshots` (
	`week_start` text NOT NULL,
	`opp_id` integer NOT NULL,
	`market_code` text NOT NULL,
	`partner_id` integer NOT NULL,
	`stage` text NOT NULL,
	`status` text NOT NULL,
	`amount_usd` real NOT NULL,
	`win_rate` integer NOT NULL,
	`weighted_usd` real NOT NULL,
	`health` text NOT NULL,
	`expected_close_date` text,
	`warning_codes` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`week_start`, `opp_id`),
	FOREIGN KEY (`opp_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
