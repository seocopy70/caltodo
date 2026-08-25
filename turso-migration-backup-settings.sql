-- Cal2do 자동 백업 주기 설정(#27)
-- ⚠️ Turso 웹 콘솔은 한 번에 한 문장씩 실행하세요. (이 파일은 문장이 1개뿐입니다)

CREATE TABLE IF NOT EXISTS backup_settings (
  user_id TEXT PRIMARY KEY,
  frequency TEXT NOT NULL DEFAULT 'off',
  last_sent_at INTEGER,
  updated_at INTEGER NOT NULL
);
