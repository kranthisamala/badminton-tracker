// session.time is stored as a free-form display string (e.g. "7:00 PM"),
// never parsed elsewhere — these just bridge that display string and the
// "HH:MM" 24-hour value a native <input type="time"> needs.

export function formatTimeLabel(value: string): string {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return '';
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
}

export function parseTimeToInputValue(text: string): string {
  const match = text.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return '';
  let h = Number(match[1]);
  const m = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  if (h > 23 || m > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Combines a start/end "HH:MM" pair into the mockup's range style, e.g.
// "7:00 – 9:00 PM" — dropping the first AM/PM when both ends share one,
// spelling both out when they don't ("11:00 AM – 1:00 PM").
export function formatTimeRangeLabel(start: string, end: string): string {
  const startLabel = formatTimeLabel(start);
  if (!startLabel) return '';
  const endLabel = end ? formatTimeLabel(end) : '';
  if (!endLabel) return startLabel;

  const [startClock, startPeriod] = startLabel.split(' ');
  const [, endPeriod] = endLabel.split(' ');
  if (startPeriod === endPeriod) return `${startClock} – ${endLabel}`;
  return `${startLabel} – ${endLabel}`;
}

// Reverses formatTimeRangeLabel (or plain single-time text) back into the
// "HH:MM" pair the two native time inputs need, for editing an existing
// session. A start segment with no AM/PM of its own (the common "7:00 – 9:00
// PM" case) inherits the end segment's period.
export function parseTimeRangeToInputValues(text: string): { start: string; end: string } {
  const trimmed = text.trim();
  if (!trimmed) return { start: '', end: '' };

  const parts = trimmed.split(/\s*[–-]\s*|\s+to\s+/i).filter(Boolean);
  if (parts.length < 2) return { start: parseTimeToInputValue(trimmed), end: '' };

  const [rawStart, rawEnd] = parts;
  const endPeriod = rawEnd.trim().match(/AM|PM/i)?.[0];
  const startText = !/AM|PM/i.test(rawStart) && endPeriod ? `${rawStart.trim()} ${endPeriod}` : rawStart;

  return { start: parseTimeToInputValue(startText), end: parseTimeToInputValue(rawEnd) };
}
