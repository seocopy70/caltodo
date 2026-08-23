// 표준 iCalendar(.ics) 가져오기/내보내기 헬퍼

function pad(n: number) { return String(n).padStart(2, '0'); }
function toICSDateTime(d: Date) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; }
function escapeICSText(text: string) { return String(text || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function foldLine(line: string) { return line; }

export type ExportableEvent = { id: string; title: string; start: Date; end: Date; endDate?: Date | null; location?: string; description?: string; recurrenceType?: 'none' | 'weekly' | 'monthly' | 'yearly'; };
const RRULE_MAP: Record<string, string> = { weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };

export function eventsToICS(events: ExportableEvent[]): string {
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CalTodo//KO', 'CALSCALE:GREGORIAN'];
  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@caltodo`);
    lines.push(`DTSTAMP:${toICSDateTime(new Date())}`);
    lines.push(`DTSTART:${toICSDateTime(ev.start)}`);
    const endDateTime = ev.endDate ? new Date(ev.endDate) : ev.end;
    if (ev.endDate) endDateTime.setHours(ev.end.getHours(), ev.end.getMinutes(), ev.end.getSeconds());
    lines.push(`DTEND:${toICSDateTime(endDateTime)}`);
    lines.push(foldLine(`SUMMARY:${escapeICSText(ev.title)}`));
    if (ev.location) lines.push(foldLine(`LOCATION:${escapeICSText(ev.location)}`));
    if (ev.description) lines.push(foldLine(`DESCRIPTION:${escapeICSText(ev.description)}`));
    if (ev.recurrenceType && RRULE_MAP[ev.recurrenceType]) lines.push(`RRULE:${RRULE_MAP[ev.recurrenceType]}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/calendar;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export type ParsedICSEvent = {
  title: string; start: Date; end: Date; location?: string; description?: string;
  recurrenceType: 'none'; externalUid?: string; isRecurring?: boolean;
};

type RRule = { freq: 'WEEKLY' | 'MONTHLY' | 'YEARLY'; interval: number; count?: number; until?: Date; };
function unescapeICSText(text: string) { return text.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\'); }

function parseICSDate(value: string, keyWithParams = ''): Date {
  const clean = value.trim(); const y = Number(clean.slice(0, 4)); const mo = Number(clean.slice(4, 6)) - 1; const d = Number(clean.slice(6, 8));
  const isUtc = clean.endsWith('Z'); const raw = isUtc ? clean.slice(0, -1) : clean;
  if (raw.length <= 8) return new Date(y, mo, d);
  const h = Number(raw.slice(9, 11)) || 0; const mi = Number(raw.slice(11, 13)) || 0; const s = Number(raw.slice(13, 15)) || 0;
  if (isUtc) return new Date(Date.UTC(y, mo, d, h, mi, s));
  const tzid = /TZID=([^;:]+)/i.exec(keyWithParams)?.[1];
  if (tzid && tzid !== 'Asia/Seoul') console.warn(`[ICS] unsupported timezone ${tzid}; preserving wall-clock time`);
  return new Date(y, mo, d, h, mi, s);
}

function parseRRule(value: string): RRule | null {
  const map = new Map<string, string>();
  for (const part of value.split(';')) { const [k, v] = part.split('='); if (k && v) map.set(k.toUpperCase(), v.toUpperCase()); }
  const freq = map.get('FREQ');
  if (freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') return null;
  const interval = Math.max(1, Number(map.get('INTERVAL') || 1));
  const count = map.has('COUNT') ? Math.max(1, Number(map.get('COUNT'))) : undefined;
  const untilRaw = map.get('UNTIL'); const until = untilRaw ? parseICSDate(untilRaw) : undefined;
  return { freq, interval, count, until };
}
function addMonthsClamped(date: Date, months: number) { const result = new Date(date); const day = result.getDate(); result.setDate(1); result.setMonth(result.getMonth() + months); const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate(); result.setDate(Math.min(day, lastDay)); return result; }
function addYearsClamped(date: Date, years: number) { const result = new Date(date); const month = result.getMonth(); const day = result.getDate(); result.setDate(1); result.setFullYear(result.getFullYear() + years); result.setMonth(month); const lastDay = new Date(result.getFullYear(), month + 1, 0).getDate(); result.setDate(Math.min(day, lastDay)); return result; }

function expandRecurringEvent(base: { title: string; start: Date; end: Date; location?: string; description?: string; uid?: string; rrule: RRule; }): ParsedICSEvent[] {
  const results: ParsedICSEvent[] = []; const duration = base.end.getTime() - base.start.getTime(); let current = new Date(base.start); let occurrence = 0; const hardStop = new Date(base.start); hardStop.setFullYear(hardStop.getFullYear() + 10);
  while (occurrence < 1000 && current <= hardStop) {
    if (base.rrule.until && current > base.rrule.until) break;
    if (base.rrule.count && occurrence >= base.rrule.count) break;
    results.push({ title: base.title, start: new Date(current), end: new Date(current.getTime() + duration), location: base.location, description: base.description, recurrenceType: 'none', externalUid: `${base.uid || base.title}|${current.toISOString()}`, isRecurring: true });
    occurrence++;
    if (base.rrule.freq === 'WEEKLY') current = new Date(current.getTime() + base.rrule.interval * 7 * 24 * 60 * 60 * 1000);
    else if (base.rrule.freq === 'MONTHLY') current = addMonthsClamped(current, base.rrule.interval);
    else current = addYearsClamped(current, base.rrule.interval);
  }
  return results;
}

export function parseICS(content: string): ParsedICSEvent[] {
  const unfolded = content.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, ''); const lines = unfolded.split('\n'); const results: ParsedICSEvent[] = []; let current: any = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line === 'END:VEVENT') {
      if (current && current.start) {
        const base = { title: current.title || '(제목 없음)', start: current.start as Date, end: (current.end || current.start) as Date, location: current.location as string | undefined, description: current.description as string | undefined, uid: current.externalUid as string | undefined };
        const rule = current.rrule ? parseRRule(current.rrule) : null;
        if (rule) results.push(...expandRecurringEvent({ ...base, rrule: rule }));
        else results.push({ ...base, recurrenceType: 'none', externalUid: base.uid || `${base.title}|${base.start.toISOString()}`, isRecurring: false });
      }
      current = null; continue;
    }
    if (!current) continue;
    const sepIdx = line.indexOf(':'); if (sepIdx === -1) continue;
    const rawKey = line.slice(0, sepIdx); const value = line.slice(sepIdx + 1); const key = rawKey.split(';')[0].toUpperCase();
    if (key === 'UID') current.externalUid = value.trim();
    else if (key === 'SUMMARY') current.title = unescapeICSText(value);
    else if (key === 'LOCATION') current.location = unescapeICSText(value);
    else if (key === 'DESCRIPTION') current.description = unescapeICSText(value);
    else if (key === 'DTSTART') current.start = parseICSDate(value, rawKey);
    else if (key === 'DTEND') current.end = parseICSDate(value, rawKey);
    else if (key === 'RRULE') current.rrule = value;
  }
  return results;
}
