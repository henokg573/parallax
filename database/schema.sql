CREATE DATABASE IF NOT EXISTS `parallax`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `parallax`;

CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super-admin', 'administrator', 'editor', 'check-in') NOT NULL DEFAULT 'editor',
  failed_login_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY admins_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS folders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY folders_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY tags_slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  alt VARCHAR(255) NOT NULL DEFAULT '',
  folder_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY media_filename_unique (filename),
  KEY media_folder_idx (folder_id),
  CONSTRAINT media_folder_fk FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_tags (
  media_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (media_id, tag_id),
  CONSTRAINT media_tags_media_fk FOREIGN KEY (media_id) REFERENCES media (id) ON DELETE CASCADE,
  CONSTRAINT media_tags_tag_fk FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS experiences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(190) NOT NULL,
  title_en VARCHAR(200) NOT NULL,
  title_am VARCHAR(200) NOT NULL DEFAULT '',
  kind ENUM('trip', 'event', 'faith', 'workshop', 'other') NOT NULL DEFAULT 'trip',
  summary_en TEXT NOT NULL,
  summary_am TEXT NOT NULL,
  location_en VARCHAR(200) NOT NULL,
  location_am VARCHAR(200) NOT NULL DEFAULT '',
  start_date DATETIME NOT NULL,
  end_date DATETIME NULL,
  capacity INT UNSIGNED NULL,
  price DECIMAL(10,2) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'ETB',
  registration_url VARCHAR(1000) NULL,
  image_url VARCHAR(1000) NULL,
  resource_url VARCHAR(1000) NULL,
  resource_id BIGINT UNSIGNED NULL,
  image_id BIGINT UNSIGNED NULL,
  video_id BIGINT UNSIGNED NULL,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY experiences_slug_unique (slug),
  KEY experiences_status_start_idx (status, start_date),
  KEY experiences_image_idx (image_id),
  KEY experiences_resource_idx (resource_id),
  KEY experiences_video_idx (video_id),
  CONSTRAINT experiences_image_fk FOREIGN KEY (image_id) REFERENCES media (id) ON DELETE SET NULL,
  CONSTRAINT experiences_resource_fk FOREIGN KEY (resource_id) REFERENCES media (id) ON DELETE SET NULL,
  CONSTRAINT experiences_video_fk FOREIGN KEY (video_id) REFERENCES media (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(190) NOT NULL,
  title_en VARCHAR(200) NOT NULL,
  title_am VARCHAR(200) NOT NULL DEFAULT '',
  excerpt_en TEXT NOT NULL,
  excerpt_am TEXT NOT NULL,
  body_en MEDIUMTEXT NOT NULL,
  body_am MEDIUMTEXT NOT NULL,
  author_name_en VARCHAR(160) NOT NULL DEFAULT '',
  author_name_am VARCHAR(160) NOT NULL DEFAULT '',
  image_id BIGINT UNSIGNED NULL,
  video_id BIGINT UNSIGNED NULL,
  published_at DATETIME NULL,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY stories_slug_unique (slug),
  KEY stories_status_published_idx (status, published_at),
  KEY stories_image_idx (image_id),
  KEY stories_video_idx (video_id),
  CONSTRAINT stories_image_fk FOREIGN KEY (image_id) REFERENCES media (id) ON DELETE SET NULL,
  CONSTRAINT stories_video_fk FOREIGN KEY (video_id) REFERENCES media (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS social_posts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  platform ENUM('telegram', 'tiktok', 'instagram', 'youtube', 'facebook') NOT NULL,
  caption_en TEXT NOT NULL,
  caption_am TEXT NOT NULL,
  post_url VARCHAR(1000) NOT NULL,
  thumbnail_id BIGINT UNSIGNED NULL,
  video_id BIGINT UNSIGNED NULL,
  posted_at DATETIME NOT NULL,
  visible TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY social_posts_status_posted_idx (status, visible, posted_at),
  KEY social_posts_thumbnail_idx (thumbnail_id),
  KEY social_posts_video_idx (video_id),
  CONSTRAINT social_posts_thumbnail_fk FOREIGN KEY (thumbnail_id) REFERENCES media (id) ON DELETE SET NULL,
  CONSTRAINT social_posts_video_fk FOREIGN KEY (video_id) REFERENCES media (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_receipts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY payment_receipts_filename_unique (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  experience_id BIGINT UNSIGNED NOT NULL,
  receipt_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  preferred_channel ENUM('email', 'phone', 'whatsapp', 'telegram') NOT NULL DEFAULT 'email',
  payment_reference VARCHAR(120) NOT NULL,
  payment_status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  check_in_token CHAR(36) NOT NULL,
  ticket_email_sent_at DATETIME NULL,
  checked_in_at DATETIME NULL,
  internal_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY registrations_token_unique (check_in_token),
  KEY registrations_experience_idx (experience_id),
  KEY registrations_receipt_idx (receipt_id),
  KEY registrations_status_created_idx (payment_status, created_at),
  CONSTRAINT registrations_experience_fk FOREIGN KEY (experience_id) REFERENCES experiences (id),
  CONSTRAINT registrations_receipt_fk FOREIGN KEY (receipt_id) REFERENCES payment_receipts (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  link_url VARCHAR(1000) NULL,
  link_label VARCHAR(120) NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  dismissible TINYINT(1) NOT NULL DEFAULT 1,
  share_token CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY announcements_token_unique (share_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;