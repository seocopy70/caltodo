'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getColorClasses } from '@/lib/types';
import { formatDateKey } from '@/lib/date-utils';
import type { Todo } from '@/lib/supabase-client';
import { Check, Pencil, ChevronDown, ChevronRight, Calendar, Circle, CheckCircle2 } from 'lucide-react';

type Props = {
  todos: Todo[];
  selectedDate: Date | null;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onAddClick: () => void;
};

export default function TodoView({ todos, selectedDate, onToggle, onEdit, onAddClick }: Props) {
  const [showCompleted, setShowCompleted] = useState(false);

  const todayKey = formatDateKey(new Date());
  const selectedKey = selectedDate ? formatDateKey(selectedDate) : todayKey;

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  const todayTodos = activeTodos.filter((t) => !t.due_date || t.due_date === todayKey);
  const datedTodos = activeTodos.filter((t) => t.due_date && t.due_date !== todayKey);
  const selectedDayTodos = activeTodos.filter((t) => t.due_date === selectedKey && t.due_date !== todayKey);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">할일</h2>
          <p className="text-xs text-muted-foreground">
            {activeTodos.length}개 남음 · {completedTodos.length}개 완료
          </p>
        </div>
        <button
          onClick={onAddClick}
          className="text-xs font-medium text-foreground/80 hover:text-foreground transition-colors"
        >
          + 추가
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {/* Today's todos */}
        {selectedDayTodos.length > 0 && selectedKey !== todayKey && (
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {selectedDate!.getMonth() + 1}월 {selectedDate!.getDate()}일
            </div>
            <div className="space-y-1.5">
              {selectedDayTodos.map((todo) => (
                <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onEdit={onEdit} />
              ))}
            </div>
          </div>
        )}

        {/* Today section */}
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Circle className="h-3.5 w-3.5" />
            오늘 할일
          </div>
          {todayTodos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">오늘 할일이 없습니다</p>
          ) : (
            <div className="space-y-1.5">
              {todayTodos.map((todo) => (
                <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onEdit={onEdit} />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming/dated todos */}
        {datedTodos.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              예정된 할일
            </div>
            <div className="space-y-1.5">
              {datedTodos
                .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
                .map((todo) => (
                  <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onEdit={onEdit} />
                ))}
            </div>
          </div>
        )}

        {/* Completed todos */}
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="mb-2 flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showCompleted ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <CheckCircle2 className="h-3.5 w-3.5" />
            완료됨 ({completedTodos.length})
          </button>
          {showCompleted && (
            <div className="space-y-1.5">
              {completedTodos.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">완료된 할일이 없습니다</p>
              ) : (
                completedTodos
                  .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
                  .map((todo) => (
                    <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onEdit={onEdit} />
                  ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TodoItem({ todo, onToggle, onEdit }: { todo: Todo; onToggle: (t: Todo) => void; onEdit: (t: Todo) => void }) {
  const cc = getColorClasses(todo.color);

  return (
    <div
      className={cn(
        'group flex items-center gap-2.5 rounded-lg border p-2.5 transition-all duration-150',
        'hover:border-foreground/20',
        todo.completed ? 'border-border/30 bg-card/20 opacity-60' : cn(cc.border, cc.bg),
      )}
    >
      <button
        onClick={() => onToggle(todo)}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          todo.completed
            ? 'border-foreground bg-foreground text-background'
            : 'border-muted-foreground hover:border-foreground',
        )}
      >
        {todo.completed && <Check className="h-3 w-3" />}
      </button>

      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onEdit(todo)}>
        <p className={cn(
          'truncate text-sm font-medium',
          todo.completed && 'line-through text-muted-foreground',
        )}>
          {todo.title}
        </p>
        {todo.due_date && (
          <p className="text-xs text-muted-foreground">
            {formatDueDate(todo.due_date)}
          </p>
        )}
      </div>

      <button
        onClick={() => onEdit(todo)}
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function formatDueDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === -1) return '어제';
  if (diff < 0) return `${Math.abs(diff)}일 지남`;
  if (diff < 7) return `${diff}일 후`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
