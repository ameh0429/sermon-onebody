BEGIN;
CREATE TABLE IF NOT EXISTS notification_preferences (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 sermons BOOLEAN NOT NULL DEFAULT true, plans BOOLEAN NOT NULL DEFAULT true, replies BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind VARCHAR(16) NOT NULL, event_key VARCHAR(80) NOT NULL,
 sermon_id UUID REFERENCES sermons(id) ON DELETE CASCADE,
 study_plan_id UUID REFERENCES study_plans(id) ON DELETE CASCADE,
 post_id UUID REFERENCES discussion_posts(id) ON DELETE CASCADE,
 read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id,event_key)
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id,read_at);
COMMIT;
