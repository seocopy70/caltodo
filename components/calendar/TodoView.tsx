'use client';

import TodoListPanel from './TodoListPanel';

export default function TodoView({ todos, user, onNotify, onRefresh }: any) {
  return (
    <div className="max-w-2xl mx-auto p-2">
      <TodoListPanel todos={todos} user={user} onNotify={onNotify} onRefresh={onRefresh} />
    </div>
  );
}
