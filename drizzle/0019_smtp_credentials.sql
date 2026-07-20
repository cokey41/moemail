CREATE TABLE `smtp_credential` (
  `id` text PRIMARY KEY NOT NULL,
  `email_id` text NOT NULL,
  `user_id` text NOT NULL,
  `username` text NOT NULL,
  `password_hash` text NOT NULL,
  `enabled` integer DEFAULT true NOT NULL,
  `name` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `last_used_at` integer,
  FOREIGN KEY (`email_id`) REFERENCES `email`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `smtp_credential_email_id_idx` ON `smtp_credential` (`email_id`);
CREATE INDEX `smtp_credential_user_id_idx` ON `smtp_credential` (`user_id`);
CREATE INDEX `smtp_credential_username_idx` ON `smtp_credential` (`username`);
