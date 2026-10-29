-- Apply to an existing API database before deploying the dashboard backend.
-- Existing sermons remain published and existing accounts remain active.
BEGIN;
DO $$ BEGIN
  CREATE TYPE enum_sermons_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE sermons ADD COLUMN IF NOT EXISTS status enum_sermons_status NOT NULL DEFAULT 'published';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
DO $$ BEGIN
  CREATE TYPE enum_sermon_engagements_event AS ENUM ('view', 'listen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS sermon_engagements (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON UPDATE CASCADE ON DELETE CASCADE,
  event enum_sermon_engagements_event NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sermon_engagements_user_id_sermon_id_event
  ON sermon_engagements(user_id, sermon_id, event);
CREATE INDEX IF NOT EXISTS sermon_engagements_sermon_id ON sermon_engagements(sermon_id);
COMMIT;
