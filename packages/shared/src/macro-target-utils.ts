import type { MacroTarget } from './schemas/macro-target';
import type { EffectiveMacroTarget, WeeklyMacroTarget } from './schemas/weekly-macro-target';
import { datesInRange, formatCalendarDate, parseCalendarDate } from './date-utils';

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 0 = Monday … 6 = Sunday */
export function dayOfWeekFromDate(dateStr: string): WeekdayIndex {
  const [year, month, day] = dateStr.split('-').map(Number);
  const weekday = new Date(year, month - 1, day, 12, 0, 0, 0).getDay();
  return (weekday === 0 ? 6 : weekday - 1) as WeekdayIndex;
}

export { datesInRange };

export function upcomingDatesForWeekday(
  dayOfWeek: WeekdayIndex,
  fromDate: string,
  maxDays = 365,
): string[] {
  const dates: string[] = [];
  let current = parseCalendarDate(fromDate);
  const end = new Date(current);
  end.setDate(end.getDate() + maxDays);

  while (current <= end) {
    const date = formatCalendarDate(current);
    if (dayOfWeekFromDate(date) === dayOfWeek) {
      dates.push(date);
    }
    const next = new Date(current);
    next.setDate(next.getDate() + 1);
    current = next;
  }

  return dates;
}

export function resolveEffectiveTarget(
  date: string,
  overrides: MacroTarget[],
  weekly: WeeklyMacroTarget[],
): EffectiveMacroTarget {
  const override = overrides.find((row) => row.targetDate === date);
  if (override) {
    return {
      targetDate: date,
      calories: override.calories,
      proteinG: override.proteinG,
      fatG: override.fatG,
      carbsG: override.carbsG,
      source: 'override',
      overrideId: override.id,
    };
  }

  const dayOfWeek = dayOfWeekFromDate(date);
  const weeklyRow = weekly.find((row) => row.dayOfWeek === dayOfWeek);
  if (weeklyRow) {
    return {
      targetDate: date,
      calories: weeklyRow.calories,
      proteinG: weeklyRow.proteinG,
      fatG: weeklyRow.fatG,
      carbsG: weeklyRow.carbsG,
      source: 'weekly',
      weeklyDayOfWeek: dayOfWeek,
    };
  }

  return {
    targetDate: date,
    calories: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
    source: 'none',
  };
}

export function resolveEffectiveTargetsInRange(
  from: string,
  to: string,
  overrides: MacroTarget[],
  weekly: WeeklyMacroTarget[],
): EffectiveMacroTarget[] {
  return datesInRange(from, to).map((date) =>
    resolveEffectiveTarget(date, overrides, weekly),
  );
}
