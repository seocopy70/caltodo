/*
# Create todos table for calendar todo feature

## Overview
This migration creates the `todos` table for a personal todo/task list feature
in the calendar app. Todos can optionally have a due date, and when they do,
they appear on the calendar alongside events.

## New Tables

### todos
- `id` (uuid, primary key) — unique identifier
- `title` (text, not null) — the todo item text
- `description` (text) — optional notes
- `completed` (boolean, not null, default false) — whether the todo is done
- `due_date` (date) — optional due date; when set, the todo appears on the calendar
- `color` (text, not null, default 'blue') — color tag matching events
- `created_at` (timestamptz) — creation timestamp
- `updated_at` (timestamptz) — last modification timestamp

## Security
- RLS enabled on `todos`.
- Four policies (SELECT, INSERT, UPDATE, DELETE) for anon + authenticated,
  same single-tenant pattern as the events table.

## Notes
1. `due_date` is nullable — todos without a due date are "today" tasks by default.
2. `completed` tracks done state; completed todos are stored separately for review.
3. Index on `due_date` for calendar-range queries.
*/

CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  completed boolean NOT NULL DEFAULT false,
  due_date date,
  color text NOT NULL DEFAULT 'blue',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos (due_date);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_todos" ON todos;
CREATE POLICY "anon_select_todos" ON todos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_todos" ON todos;
CREATE POLICY "anon_insert_todos" ON todos FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_todos" ON todos;
CREATE POLICY "anon_update_todos" ON todos FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_todos" ON todos;
CREATE POLICY "anon_delete_todos" ON todos FOR DELETE
  TO anon, authenticated USING (true);
