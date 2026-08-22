'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { COLOR_OPTIONS } from '@/lib/types';
import type { Todo, NewTodo } from '@/lib/supabase-client';
import { Trash2, Save } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTodo: Todo | null;
  onSave: (todo: NewTodo, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const emptyForm: NewTodo = {
  title: '',
  description: '',
  completed: false,
  due_date: null,
  color: 'blue',
};

export default function TodoDialog({ open, onOpenChange, editingTodo, onSave, onDelete }: Props) {
  const [form, setForm] = useState<NewTodo>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (editingTodo) {
        setForm({
          title: editingTodo.title,
          description: editingTodo.description || '',
          completed: editingTodo.completed,
          due_date: editingTodo.due_date,
          color: editingTodo.color,
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, editingTodo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('제목을 입력해주세요');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(form, editingTodo?.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTodo) return;
    setSaving(true);
    try {
      await onDelete(editingTodo.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editingTodo ? '할일 수정' : '새 할일'}</DialogTitle>
          <DialogDescription>
            {editingTodo ? '할일을 수정하거나 삭제할 수 있습니다.' : '새로운 할일을 추가합니다.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="todo-title">제목</Label>
            <Input
              id="todo-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="할일 입력"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="todo-due-date">마감일</Label>
              <Input
                id="todo-due-date"
                type="date"
                value={form.due_date || ''}
                onChange={(e) => setForm({ ...form, due_date: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label>색상</Label>
              <div className="flex gap-2 pt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setForm({ ...form, color: c.key })}
                    className={cn(
                      'h-8 w-8 rounded-full transition-all duration-150',
                      c.dot,
                      form.color === c.key
                        ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110'
                        : 'hover:scale-110',
                    )}
                    aria-label={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="todo-description">설명</Label>
            <Textarea
              id="todo-description"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="메모..."
              className="resize-none"
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2">
            {editingTodo && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={saving}
                className="mr-auto"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                삭제
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
