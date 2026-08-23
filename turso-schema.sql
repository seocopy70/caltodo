-- Turso(libSQL) 스키마
-- 실행 방법: `turso db shell <데이터베이스이름> < turso-schema.sql`
-- 또는 Turso 웹 콘솔의 SQL 콘솔에 붙여넣어 실행

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  end_date INTEGER,
  location TEXT DEFAULT '',
  description TEXT DEFAULT '',
  color TEXT DEFAULT 'blue',
  recurrence_type TEXT DEFAULT 'none',
  updated_at INTEGER NOT NULL,
  source TEXT DEFAULT 'manual',
  external_uid TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_external ON events(user_id, source, external_uid);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  due_date INTEGER,
  memo TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
