import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DayPicker } from 'react-day-picker';
import { api } from '../lib/client';
import type { EffectiveMacroTarget } from '@calorie-tracker/shared';
import 'react-day-picker/style.css';

function monthRange(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export function CalendarPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(new Date());
  const { from, to } = monthRange(month);

  const { data: targets } = useQuery({
    queryKey: ['macro-targets-effective', from, to],
    queryFn: () => api.getEffectiveMacroTargets(from, to) as Promise<EffectiveMacroTarget[]>,
  });

  const modifiers = useMemo(() => {
    const weekly: Date[] = [];
    const override: Date[] = [];

    for (const target of targets ?? []) {
      if (target.source === 'none') continue;
      const [y, m, d] = target.targetDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      if (target.source === 'override') override.push(date);
      else weekly.push(date);
    }

    return { weekly, override };
  }, [targets]);

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      <p className="mb-4 text-sm text-muted">
        Tap a day to view or edit targets. Blue dot = weekly default, red dot = custom override.
      </p>
      <div className="calendar-dark rounded-xl bg-surface p-2">
        <DayPicker
          mode="single"
          month={month}
          onMonthChange={setMonth}
          onSelect={(day) => {
            if (!day) return;
            const y = day.getFullYear();
            const m = String(day.getMonth() + 1).padStart(2, '0');
            const d = String(day.getDate()).padStart(2, '0');
            navigate(`/day/${y}-${m}-${d}`);
          }}
          modifiers={modifiers}
          modifiersClassNames={{
            weekly: 'rdp-day-weekly',
            override: 'rdp-day-override',
          }}
          classNames={{
            root: 'rdp-root',
            month_caption: 'text-foreground font-semibold mb-2',
            weekday: 'text-muted text-sm',
            day: 'text-foreground',
            today: 'text-primary font-bold',
            button_previous: 'text-primary',
            button_next: 'text-primary',
          }}
        />
      </div>
      <style>{`
        .calendar-dark .rdp-root {
          --rdp-accent-color: #3b82f6;
          --rdp-accent-background-color: #2563eb;
          color: #f8fafc;
        }
        .calendar-dark .rdp-day-weekly::after {
          content: '';
          display: block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #3b82f6;
          margin: 2px auto 0;
        }
        .calendar-dark .rdp-day-override::after {
          content: '';
          display: block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f87171;
          margin: 2px auto 0;
        }
      `}</style>
    </div>
  );
}
