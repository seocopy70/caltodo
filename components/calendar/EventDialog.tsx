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
import { formatDateKeyOrNull } from '@/lib/date-utils';
import type { CalendarEvent, NewEvent } from '@/lib/supabase-client';
import { Trash2, Save } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  editingEvent: CalendarEvent | null;
  onSave: (event: NewEvent, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const emptyForm = (date: Date | null): NewEvent => ({
  title: '',
  description: '',
  date: formatDateKeyOrNull(date),
  start_time: '09:00',
  end_time: '10:00',
  color: 'blue',
  location: '',
});

export default function EventDialog({ open, onOpenChange, selectedDate, editingEvent, onSave, onDelete }: Props) {
  const [form, setForm] = useState<NewEvent>(emptyForm(selectedDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (editingEvent) {
        setForm({
          title: editingEvent.title,
          description: editingEvent.description || '',
          date: editingEvent.date,
          start_time: editingEvent.start_time,
          end_time: editingEvent.end_time,
          color: editingEvent.color,
          location: editingEvent.location || '',
        });
      } else {
        setForm(emptyForm(selectedDate));
      }
    }
  }, [open, editingEvent, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('제목을 입력해주세요');
      return;
    }
    if (form.end_time < form.start_time) {
      setError('종료 시간은 시작 시간 이후여야 합니다');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(form, editingEvent?.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEvent) return;
    setSaving(true);
    try {
      await onDelete(editingEvent.id);
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
          <DialogTitle>{editingEvent ? '일정 수정' : '새 일정'}</DialogTitle>
          <DialogDescription>
            {editingEvent ? '일정을 수정하거나 삭제할 수 있습니다.' : '캘린더에 새 일정을 추가합니다.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="일정 제목"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">날짜</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">장소</Label>
              <Input
                id="location"
                value={form.location || ''}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="선택사항"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start_time">시작</Label>
              <Input
                id="start_time"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">종료</Label>
              <Input
                id="end_time"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>색상</Label>
            <div className="flex gap-2">
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

          <div className="space-y-2">
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="메모..."
              className="resize-none"
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter className="gap-2">
            {editingEvent && (
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
