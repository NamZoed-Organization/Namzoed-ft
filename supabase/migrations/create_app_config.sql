-- App Config table
-- A single row of app-wide config, currently used to drive the
-- "update available" / "force update" prompt. Update this row by hand
-- (Supabase SQL editor or table view) after each store release —
-- there is no app-side write path, only read.

CREATE TABLE IF NOT EXISTS app_config (
  id                            TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  ios_latest_version            TEXT,
  android_latest_version        TEXT,
  ios_min_supported_version     TEXT,
  android_min_supported_version TEXT,
  update_message                TEXT,
  force_update_message          TEXT,
  updated_at                    TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Readable by anyone, including signed-out users, since the update check
-- runs before/independent of login. No INSERT/UPDATE/DELETE policies are
-- defined, so writes are only possible via the Supabase dashboard or the
-- service-role key — never from the app itself.
CREATE POLICY "Anyone can read app config"
  ON app_config FOR SELECT
  USING (true);

-- Seed the singleton row. Fill in real version numbers after your first
-- store release, then keep this row updated on every subsequent release.
INSERT INTO app_config (id, ios_latest_version, android_latest_version)
VALUES ('default', '1.0.2', '1.0.2')
ON CONFLICT (id) DO NOTHING;
