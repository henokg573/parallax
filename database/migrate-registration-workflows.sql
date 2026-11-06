USE `parallax`;

ALTER TABLE experiences
  MODIFY COLUMN kind ENUM('trip', 'event', 'faith', 'workshop', 'other') NOT NULL DEFAULT 'trip',
  ADD COLUMN image_url VARCHAR(1000) NULL AFTER registration_url,
  ADD COLUMN resource_url VARCHAR(1000) NULL AFTER image_url;

ALTER TABLE registrations
  ADD COLUMN preferred_channel ENUM('email', 'phone', 'whatsapp', 'telegram') NOT NULL DEFAULT 'email' AFTER phone;