-- Cal2do 보안폴더 기능 (기존 '비밀 메모' PIN/패턴 기능을 대체 - 폴더 단위 잠금)
-- ⚠️ Turso 웹 콘솔은 한 번에 한 문장씩 순서대로 실행하세요.
-- 참고: notes.locked/lock_type/lock_hash 컬럼은 더 이상 사용하지 않지만, 기존 데이터 보존을 위해
-- 삭제하지 않고 그대로 둡니다 (앱에서는 무시함).

-- 1) 이 폴더가 보안폴더로 지정되었는지 (사용자당 최대 1개)
ALTER TABLE note_folders ADD COLUMN is_secure INTEGER DEFAULT 0;

-- 2) 잠금 방식: 'pin' | 'pattern'
ALTER TABLE note_folders ADD COLUMN lock_type TEXT;

-- 3) 잠금 코드의 해시값 (서버에서만 비교, 원문 저장 안 함)
ALTER TABLE note_folders ADD COLUMN lock_hash TEXT;

-- 4) 연속 실패 횟수
ALTER TABLE note_folders ADD COLUMN failed_attempts INTEGER DEFAULT 0;

-- 5) 5회 이상 실패 시 영구 잠금 여부 (이메일 복구 전까지 계속 잠김)
ALTER TABLE note_folders ADD COLUMN is_locked INTEGER DEFAULT 0;

-- 6) 이메일로 보낸 복구 인증코드의 해시값 (짧은 시간만 유효)
ALTER TABLE note_folders ADD COLUMN reset_code_hash TEXT;

-- 7) 복구 인증코드 만료 시각(ms epoch)
ALTER TABLE note_folders ADD COLUMN reset_code_expires_at INTEGER;
