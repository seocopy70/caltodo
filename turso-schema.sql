-- Turso(libSQL) 스키마
-- 실행 방법: `turso db shell <데이터베이스이름> < turso-schema.sql`
-- 또는 Turso 웹 콘솔의 SQL 콘솔에 붙여넣어 실행

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start INTEGER NOT NULL,        -- unix ms
  end_time INTEGER NOT NULL,     -- unix ms ('end'은 SQL 예약어라 end_time으로 명명)
  end_date INTEGER,              -- 다중일 일정의 마지막 날짜 (unix ms, nullable)
  location TEXT DEFAULT '',
  description TEXT DEFAULT '',
  color TEXT DEFAULT 'blue',
  recurrence_type TEXT DEFAULT 'none',  -- none | weekly | monthly | yearly
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  due_date INTEGER,              -- unix ms, nullable
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
