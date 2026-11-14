-- Sales feedback (2026-11-14): "VI owner" is a VI name typed by the user (with suggestions), not a login account.
ALTER TABLE `opportunities` ADD `vi_owner` text;
--> statement-breakpoint
UPDATE `opportunities` SET `vi_owner` = (SELECT `account` FROM `users` WHERE `users`.`id` = `opportunities`.`vi_owner_id`) WHERE `vi_owner_id` IS NOT NULL;
