-- CalTodo Todo 정렬 순서 저장
ALTER TABLE todos ADD COLUMN order_index REAL DEFAULT 0;
UPDATE todos SET order_index = created_at WHERE order_index = 0 OR order_index IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_user_order ON todos(user_id, completed, order_index);
