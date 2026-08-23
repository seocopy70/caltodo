-- Cal2do notes archive / Today note selection
ALTER TABLE notes ADD COLUMN show_on_today INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_notes_user_deleted ON notes(user_id, deleted_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_user_today ON notes(user_id, show_on_today, deleted_at);
