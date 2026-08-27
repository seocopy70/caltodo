-- Cal2do 할일탭 폴더 기능
-- ⚠️ Turso 웹 콘솔 SQL 콘솔은 한 번에 한 문장씩만 안정적으로 실행됩니다.
-- 아래 3개 문장을 반드시 하나씩 순서대로 실행하세요.
-- 기존 데이터(할일/일정/메모)는 전혀 건드리지 않는 추가(add)성 변경입니다.

-- 1) 폴더 테이블 생성 (note_folders와 동일한 구조, 보안폴더 기능은 없음)
CREATE TABLE IF NOT EXISTS todo_folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  order_index REAL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 2) 폴더 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_todo_folders_user ON todo_folders(user_id);

-- 3) todos 테이블에 폴더 연결 컬럼 추가 (NULL이면 '미분류')
ALTER TABLE todos ADD COLUMN folder_id TEXT;
