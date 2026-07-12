import { datesInRange, formatCalendarDate, parseCalendarDate } from '@calorie-tracker/shared';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Sunday-start week containing the given YYYY-MM-DD date. */
export function weekDatesContaining(dateStr: string): string[] {
  const date = parseCalendarDate(dateStr);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return datesInRange(formatCalendarDate(start), formatCalendarDate(end));
}

export function weekdayLetter(dateStr: string): string {
  const day = parseCalendarDate(dateStr).getDay();
  return WEEKDAY_LETTERS[day] ?? '?';
}

export function formatShortDayTitle(dateStr: string): string {
  const date = parseCalendarDate(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatPickerHeaderDate(dateStr: string): string {
  const date = parseCalendarDate(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function dateToPickerDate(dateStr: string): Date {
  return parseCalendarDate(dateStr);
}

export function pickerDateToString(date: Date): string {
  return formatCalendarDate(date);
}

export function isValidDateParam(value: string | null): value is string {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
