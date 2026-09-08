'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format, getYear, isToday } from 'date-fns';
import { ChevronDown, ChevronRight, ListCollapse, ListTree, Locate, MapPin, AlignLeft } from 'lucide-react';
import EventModal from './EventModal';
import { getRecurrenceType } from '../../lib/recurrence';

export default function EventListView({ events, user, onNotify, onRefresh }: any) {
  const currentYear = new Date().getFullYear();
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({ [String(currentYear)]: true });
  const [ascending, setAscending] = useState(true); // 기본 정렬: 시간순(오래된 순)
  const [allExpanded, setAllExpanded] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const todayRef = useRef<HTMLButtonElement>(null);

  const years = useMemo(() => {
    const map = new Map<number, any[]>();
    [...events]
      .sort((a, b) => (ascending ? a.start.getTime() - b.start.getTime() : b.start.getTime() - a.start.getTime()))
      .forEach((e) => {
        const y = getYear(e.start);
        if (!map.has(y)) map.set(y, []);
        map.get(y)!.push(e);
      });
    return Array.from(map.entries()).sort((a, b) => (ascending ? a[0] - b[0] : b[0] - a[0]));
  }, [events, ascending]);

  const toggleYear = (year: number) => setOpenYears((prev) => ({ ...prev, [String(year)]: !prev[String(year)] }));

  const toggleAll = () => {
    const next = !allExpanded;
    setAllExpanded(next);
    setOpenYears(Object.fromEntries(years.map(([y]) => [String(y), next])));
  };

  const jumpToToday = () => {
    setOpenYears((prev) => ({ ...prev, [String(currentYear)]: true }));
    setTimeout(() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  // 목록을 처음 열었을 때도 맨 위(연도 첫 항목)가 아니라 오늘 날짜 위치로 바로 스크롤되게 함
  // (시간순이 기본이 되면서 첫 화면이 그 해 1월 1일이 되는 걸 방지). events가 나중에 비동기로
  // 채워질 수 있어 데이터가 실제로 들어온 뒤 딱 한 번만 실행.
  const didAutoJumpRef = useRef(false);
  useEffect(() => {
    if (didAutoJumpRef.current || events.length === 0) return;
    didAutoJumpRef.current = true;
    setOpenYears((prev) => ({ ...prev, [String(currentYear)]: true }));
    setTimeout(() => todayRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' }), 50);
  }, [events, currentYear]);

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-2">
      {/* 상단 버튼줄을 화면 헤더 바로 아래에 붙여서(sticky), 목록을 한참 내려도 정렬/오늘이동/펼치기 버튼을
          다시 스크롤해서 올라가지 않고 바로 쓸 수 있게 함. top 값은 실제 앱 헤더 높이(--app-header-h,
          page.tsx에서 측정)를 그대로 사용 — 모바일에서는 헤더가 줄바꿈으로 더 높아지므로 고정값은 안 맞음. */}
      <div
        className="sticky z-20 -mx-2 px-2 py-2 bg-slate-50/95 dark:bg-[#0f172a]/95 backdrop-blur flex items-center justify-between gap-2 flex-wrap"
        style={{ top: 'var(--app-header-h, 56px)' }}
      >
        <h2 className="text-2xl font-black">일정 목록</h2>
        <div className="flex items-center gap-2">
          <button onClick={jumpToToday} className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/60 text-xs font-bold flex items-center gap-1"><Locate className="w-3.5 h-3.5" /> 오늘</button>
          <button onClick={toggleAll} className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/60 text-xs font-bold flex items-center gap-1">
            {allExpanded ? <><ListCollapse className="w-3.5 h-3.5" /> 전체 닫기</> : <><ListTree className="w-3.5 h-3.5" /> 전체 펼치기</>}
          </button>
          <button onClick={() => setAscending((v) => !v)} className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/60 text-xs font-bold">
            {ascending ? '시간순 ↑' : '최신순 ↓'}
          </button>
        </div>
      </div>

      {years.length === 0 && <div className="text-center text-slate-500 py-16">등록된 일정이 없습니다.</div>}

      {years.map(([year, yearEvents]) => {
        const isCurrent = year === currentYear;
        const open = !!openYears[String(year)];
        return (
          <section key={year} className="space-y-2">
            <button onClick={() => toggleYear(year)} className="w-full flex items-center justify-between px-3 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <span className="font-black text-lg">{year}년 {isCurrent && <span className="text-xs text-blue-400 ml-1">올해</span>}</span>
              {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
            {open && (
              <div className="space-y-2 pl-1">
                {yearEvents.map((event: any) => {
                  const repeated = getRecurrenceType(event) !== 'none';
                  const todayMarker = isToday(event.start);
                  return (
                    <button key={event.id} ref={todayMarker ? todayRef : undefined} onClick={() => setEditingEvent(event)} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition ${todayMarker ? 'ring-2 ring-blue-500' : ''} ${repeated ? 'bg-violet-500/10 border-violet-500/35' : 'bg-blue-500/5 border-slate-700/50 hover:border-blue-500/40'}`}>
                      <div className="w-20 shrink-0 text-xs font-bold text-slate-400">{format(event.start, 'yyyy.MM.dd')}</div>
                      <div className="w-14 shrink-0 text-xs font-bold text-slate-500">{format(event.start, 'HH:mm')}</div>
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold truncate">{event.title}</span>
                        </div>
                        {event.location ? <span className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0"><MapPin className="w-3.5 h-3.5" />{event.location}</span> : event.description ? <span className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0 truncate"><AlignLeft className="w-3.5 h-3.5 shrink-0" />{event.description}</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {editingEvent && <EventModal date={editingEvent.start} editingEvent={editingEvent} user={user} notify={onNotify} onClose={() => setEditingEvent(null)} onRefresh={onRefresh} allEvents={events} />}
    </div>
  );
}
