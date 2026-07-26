export const DEFAULT_TIME_ZONE = 'America/Los_Angeles';

export function resolveTimeZone(timeZone?: string | null): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function getClientTimeZone(): string {
  try {
    return resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function parseCalendarDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateInTimeZone(date: Date, timeZone?: string): string {
  const tz = resolveTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function todayDateString(timeZone?: string): string {
  return formatDateInTimeZone(new Date(), timeZone);
}

export function datesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let current = parseCalendarDate(from);
  const end = parseCalendarDate(to);

  while (current <= end) {
    dates.push(formatCalendarDate(current));
    const next = new Date(current);
    next.setDate(next.getDate() + 1);
    current = next;
  }

  return dates;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

export function zonedDateTimeToUtc(
  date: string,
  time: string,
  timeZone?: string,
): Date {
  const tz = resolveTimeZone(timeZone);
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, secondPart] = time.split(':');
  const second = Number(secondPart?.split('.')[0] ?? 0);
  const ms = Number(secondPart?.split('.')[1] ?? 0);

  let utcGuess = Date.UTC(year, month - 1, day, Number(hour), Number(minute), second, ms);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utcGuess), tz);
    utcGuess = Date.UTC(year, month - 1, day, Number(hour), Number(minute), second, ms) - offset;
  }

  return new Date(utcGuess);
}

export function localDayBoundsUtc(date: string, timeZone?: string) {
  const tz = resolveTimeZone(timeZone);
  return {
    start: zonedDateTimeToUtc(date, '00:00:00', tz),
    end: zonedDateTimeToUtc(date, '23:59:59.999', tz),
  };
}

export function isLogOnCalendarDate(
  loggedAt: string,
  date: string,
  timeZone?: string,
): boolean {
  return formatDateInTimeZone(new Date(loggedAt), timeZone) === date;
}

/** e.g. "Wednesday, 7/9/2026" */
export function formatHeaderDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const weekday = new Date(year, month - 1, day, 12, 0, 0, 0).toLocaleDateString('en-US', {
    weekday: 'long',
  });
  return `${weekday}, ${month}/${day}/${year}`;
}

/** e.g. "July 25, 2026" */
export function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
