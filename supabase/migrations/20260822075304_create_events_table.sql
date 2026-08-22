/*
# Create events table for personal calendar app

## Overview
This migration creates the `events` table that stores calendar entries for a
personal calendar application. The app is single-tenant (no sign-in screen),
so events are intentionally shared and accessible to both anon and authenticated
roles.

## New Tables

### events
- `id` (uuid, primary key) — unique identifier for each event
- `title` (text, not null) — the event title
- `description` (text) — optional longer description / notes
- `date` (date, not null) — the calendar day the event is on
- `start_time` (time, not null) — when the event starts (HH:MM)
- `end_time` (time, not null) — when the event ends (HH:MM)
- `color` (text, not null, default 'blue') — color tag for visual categorization
- `location` (text) — optional location for the event
- `created_at` (timestamptz) — when the record was created
- `updated_at` (timestamptz) — when the record was last modified

## Security
- Row Level Security is enabled on `events`.
- Four separate policies (SELECT, INSERT, UPDATE, DELETE) allow both `anon`
  and `authenticated` roles full CRUD access. This is intentional: the app has
  no sign-in screen, so the anon-key frontend client must be able to read and
  write its own data.

## Notes
1. The `date` column uses the `date` type (not timestamp) so events are tied to
   calendar days regardless of timezone.
2. `start_time` and `end_time` use the `time` type for simple HH:MM storage.
3. `color` stores a color name string (e.g. 'blue', 'green', 'red') that the
   frontend maps to Tailwind color classes.
4. An index on `date` is added for fast month-range queries.
*/

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  date date NOT NULL,
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '10:00',
  color text NOT NULL DEFAULT 'blue',
  location text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events (date);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_events" ON events;
CREATE POLICY "anon_select_events" ON events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_events" ON events;
CREATE POLICY "anon_insert_events" ON events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_events" ON events;
CREATE POLICY "anon_update_events" ON events FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_events" ON events;
CREATE POLICY "anon_delete_events" ON events FOR DELETE
  TO anon, authenticated USING (true);
