-- Cal2do 반복횟수(#18) + 음력 생일/기념일(#19)
-- ⚠️ Turso 웹 콘솔은 한 번에 한 문장씩 실행하세요. 아래 4개 문장을 순서대로 실행하세요.

-- 1) 반복 총 횟수 (NULL이면 무한 반복)
ALTER TABLE events ADD COLUMN recurrence_count INTEGER;

-- 2) 음력 기념일 여부
ALTER TABLE events ADD COLUMN is_lunar INTEGER DEFAULT 0;

-- 3) 음력 월
ALTER TABLE events ADD COLUMN lunar_month INTEGER;

-- 4) 음력 일
ALTER TABLE events ADD COLUMN lunar_day INTEGER;
