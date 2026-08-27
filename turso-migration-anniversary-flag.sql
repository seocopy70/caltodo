-- Cal2do 기념일 명시적 플래그 (기존엔 색상/allDay로 추정했었음)
-- ⚠️ Turso 웹 콘솔은 한 번에 한 문장씩 실행하세요.

ALTER TABLE events ADD COLUMN is_anniversary INTEGER DEFAULT 0;
