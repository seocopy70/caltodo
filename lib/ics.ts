// 표준 iCalendar(.ics) 형식으로 내보내기/가져오기.

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toICSDateTime(d: Date) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function escapeICSText(text: string) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line: string) {
  return line;
}

export type ExportableEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  endDate?: Date | null;
  location?: string;
  description?: string;
  recurrenceType?: 'none' | 'weekly' | 'monthly' | 'yearly';
};

const RRULE_MAP: Record<string, string> = {
  weekly: 'FREQ=WEEKLY',
  monthly: 'FREQ=MONTHLY',
  yearly: 'FREQ=YEARLY',
};

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
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type ParsedICSEvent = {
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  recurrenceType: 'none' | 'weekly' | 'monthly' | 'yearly';
  externalUid?: string;
};

function unescapeICSText(text: string) {
  return text.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseICSDate(value: string): Date {
  const clean = value.replace('Z', '');
  const y = parseInt(clean.slice(0, 4), 10);
  const mo = parseInt(clean.slice(4, 6), 10) - 1;
  const d = parseInt(clean.slice(6, 8), 10);
  if (clean.length <= 8) return new Date(y, mo, d);
  const h = parseInt(clean.slice(9, 11), 10) || 0;
  const mi = parseInt(clean.slice(11, 13), 10) || 0;
  const s = parseInt(clean.slice(13, 15), 10) || 0;
  return new Date(y, mo, d, h, mi, s);
}

export function parseICS(content: string): ParsedICSEvent[] {
  const unfolded = content.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const lines = unfolded.split('\n');
  const results: ParsedICSEvent[] = [];
  let current: any = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current && current.start) {
        results.push({
          title: current.title || '(제목 없음)',
          start: current.start,
          end: current.end || current.start,
          location: current.location,
          description: current.description,
          recurrenceType: current.recurrenceType || 'none',
          externalUid: current.externalUid,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const sepIdx = line.indexOf(':');
    if (sepIdx === -1) continue;
    const rawKey = line.slice(0, sepIdx);
    const value = line.slice(sepIdx + 1);
    const key = rawKey.split(';')[0].toUpperCase();
    if (key === 'UID') current.externalUid = value.trim();
    else if (key === 'SUMMARY') current.title = unescapeICSText(value);
    else if (key === 'LOCATION') current.location = unescapeICSText(value);
    else if (key === 'DESCRIPTION') current.description = unescapeICSText(value);
    else if (key === 'DTSTART') current.start = parseICSDate(value);
    else if (key === 'DTEND') current.end = parseICSDate(value);
    else if (key === 'RRULE') {
      if (/FREQ=WEEKLY/i.test(value)) current.recurrenceType = 'weekly';
      else if (/FREQ=MONTHLY/i.test(value)) current.recurrenceType = 'monthly';
      else if (/FREQ=YEARLY/i.test(value)) current.recurrenceType = 'yearly';
    }
  }
  return results;
}
