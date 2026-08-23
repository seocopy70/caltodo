-- 기존 events 테이블에 Google/ICS 가져오기 중복 방지용 컬럼 추가
ALTER TABLE events ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE events ADD COLUMN external_uid TEXT;
CREATE INDEX IF NOT EXISTS idx_events_external ON events(user_id, source, external_uid);
