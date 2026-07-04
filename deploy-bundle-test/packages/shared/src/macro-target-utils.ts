import type { MacroTarget } from './schemas/macro-target';
import type { EffectiveMacroTarget, WeeklyMacroTarget } from './schemas/weekly-macro-target';

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
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  return (day === 0 ? 6 : day - 1) as WeekdayIndex;
}

export function datesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
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
