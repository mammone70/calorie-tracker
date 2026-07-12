import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HeaderActions } from './HeaderActions';
import { api } from '../lib/client';
import { cn } from '@/lib/utils';
import {
  dateToPickerDate,
  formatPickerHeaderDate,
  formatShortDayTitle,
  pickerDateToString,
  weekDatesContaining,
  weekdayLetter,
} from '../lib/week';
import type { FoodLogEntry } from '@calorie-tracker/shared';
import 'react-day-picker/style.css';

type DayStatus = 'complete' | 'empty';

function dayStatus(logs: FoodLogEntry[] | undefined): DayStatus {
  if (!logs || logs.length === 0) return 'empty';
  const active = logs.filter((log) => !log.deletedAt);
  if (active.length === 0) return 'empty';
  const hasPending = active.some((log) => log.status === 'pending');
  return hasPending ? 'empty' : 'complete';
}

type DayViewHeaderProps = {
  selectedDate: string;
  today: string;
  onSelectDate: (date: string) => void;
};

export function DayViewHeader({ selectedDate, today, onSelectDate }: DayViewHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(selectedDate);
  const [pickerMonth, setPickerMonth] = useState(() => dateToPickerDate(selectedDate));

  useEffect(() => {
    if (!pickerOpen) return;
    setDraftDate(selectedDate);
    setPickerMonth(dateToPickerDate(selectedDate));
  }, [pickerOpen, selectedDate]);

  const weekDates = useMemo(() => weekDatesContaining(selectedDate), [selectedDate]);

  const weekLogQueries = useQueries({
    queries: weekDates.map((date) => ({
      queryKey: ['food-logs', date],
      queryFn: () => api.getFoodLogs(date) as Promise<FoodLogEntry[]>,
    })),
  });

  const title = selectedDate === today ? 'Today' : formatShortDayTitle(selectedDate);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/60 bg-app pb-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto w-full min-w-0 max-w-lg space-y-3 px-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex min-w-0 items-center gap-1.5 text-left"
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
            >
              <span className="truncate text-2xl font-bold tracking-tight text-foreground">
                {title}
              </span>
              <ChevronDown className="size-5 shrink-0 text-foreground" aria-hidden />
            </button>
            <HeaderActions />
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date, index) => {
              const isSelected = date === selectedDate;
              const isToday = date === today;
              const status = dayStatus(weekLogQueries[index]?.data);
              const letter = weekdayLetter(date);

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => onSelectDate(date)}
                  className="flex flex-col items-center gap-1.5 rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Select ${date}`}
                  aria-pressed={isSelected}
                >
                  <span className="flex h-2 items-center justify-center">
                    {isToday ? (
                      <span className="size-1.5 rounded-full bg-foreground" aria-hidden />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isSelected || isToday ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {letter}
                  </span>
                  <span
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full border-2 transition-colors',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : status === 'complete'
                          ? 'border-muted-foreground/50 bg-muted-foreground/80 text-background'
                          : 'border-muted-foreground/40 bg-transparent text-transparent',
                    )}
                  >
                    {status === 'complete' || isSelected ? (
                      <Check className="size-3.5 stroke-[3]" aria-hidden />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="bg-primary px-4 py-4 text-primary-foreground">
            <p className="text-[0.65rem] font-semibold tracking-[0.12em] text-primary-foreground/80">
              SELECT A DATE
            </p>
            <DialogTitle className="text-2xl font-semibold text-primary-foreground">
              {formatPickerHeaderDate(draftDate)}
            </DialogTitle>
          </DialogHeader>

          <div className="calendar-day-picker flex justify-center px-2 py-3">
            <DayPicker
              mode="single"
              selected={dateToPickerDate(draftDate)}
              month={pickerMonth}
              onMonthChange={setPickerMonth}
              onSelect={(day) => {
                if (!day) return;
                setDraftDate(pickerDateToString(day));
                setPickerMonth(day);
              }}
              classNames={{
                root: 'rdp-root',
                month_caption: 'text-foreground font-semibold mb-2',
                weekday: 'text-muted-foreground text-sm',
                day: 'text-foreground',
                today: 'font-bold',
                selected: 'bg-primary text-primary-foreground rounded-full',
                button_previous: 'text-primary',
                button_next: 'text-primary',
              }}
            />
          </div>

          <DialogFooter className="border-t border-border px-4 py-3 sm:justify-end">
            <Button variant="ghost" className="text-primary" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="ghost"
              className="text-primary"
              onClick={() => {
                onSelectDate(draftDate);
                setPickerOpen(false);
              }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
