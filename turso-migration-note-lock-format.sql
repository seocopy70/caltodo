-- Cal2do 메모 형식(체크리스트/번호매김, #22) + 비밀메모 PIN/패턴 잠금(#23)
-- ⚠️ Turso 웹 콘솔은 한 번에 한 문장씩 실행하세요. 아래 4개 문장을 순서대로 실행하세요.
-- 참고: 비밀메모는 '화면 가림' 수준의 간단한 잠금입니다. 내용 자체를 서버에서 암호화하지는 않습니다.

-- 1) 메모 형식: 'plain' | 'checklist' | 'numbered'
ALTER TABLE notes ADD COLUMN format TEXT DEFAULT 'plain';

-- 2) 잠금 여부
ALTER TABLE notes ADD COLUMN locked INTEGER DEFAULT 0;

-- 3) 잠금 방식: 'pin' | 'pattern'
ALTER TABLE notes ADD COLUMN lock_type TEXT;

-- 4) 잠금 코드의 해시값 (원문 PIN/패턴은 저장하지 않음)
ALTER TABLE notes ADD COLUMN lock_hash TEXT;
