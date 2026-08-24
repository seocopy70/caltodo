-- Cal2do 할일 <-> 일정 연동 (날짜 설정된 할일이 캘린더에도 표시되도록)
ALTER TABLE todos ADD COLUMN linked_event_id TEXT;
ALTER TABLE events ADD COLUMN linked_todo_id TEXT;
