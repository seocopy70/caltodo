-- Cal2do todos 우선순위(빨/노/녹) + 완료 시각 기록
ALTER TABLE todos ADD COLUMN priority TEXT;
ALTER TABLE todos ADD COLUMN completed_at INTEGER;
