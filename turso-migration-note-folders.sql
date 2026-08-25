-- Cal2do 메모 폴더 기능(#23)
-- ⚠️ Turso 웹 콘솔 SQL 콘솔은 한 번에 한 문장씩만 안정적으로 실행됩니다.
-- 아래 3개 문장을 반드시 하나씩 순서대로 실행하세요.

-- 1) 폴더 테이블 생성
CREATE TABLE IF NOT EXISTS note_folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  order_index REAL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 2) 폴더 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_note_folders_user ON note_folders(user_id);

-- 3) notes 테이블에 폴더 연결 컬럼 추가 (NULL이면 '미분류')
ALTER TABLE notes ADD COLUMN folder_id TEXT;
