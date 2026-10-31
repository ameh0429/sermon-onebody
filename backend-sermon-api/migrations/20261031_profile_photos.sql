-- Additive migration; existing users keep their initials until they upload a photo.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url varchar(2048);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_public_id varchar(255);
COMMIT;
