import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChartLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/client';
import {
  DEFAULT_WEIGHT_UNIT,
  formatCalendarDate,
  formatDisplayDate,
  parseCalendarDate,
  type BodyWeightLog,
  type WeightUnit,
} from '@calorie-tracker/shared';
import { cn, inputFieldClass } from '@/lib/utils';
import { showErrorFromUnknown, showSuccess } from '@/lib/toast';

type BodyWeightCardProps = {
  date: string;
};

type RangePreset = 7 | 30 | 90 | 365;

function shiftDate(date: string, days: number): string {
  const d = parseCalendarDate(date);
  d.setDate(d.getDate() + days);
  return formatCalendarDate(d);
}

function formatWeight(value: number, unit: WeightUnit): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${unit}`;
}

function BodyWeightChart({
  logs,
  unit,
}: {
  logs: BodyWeightLog[];
  unit: WeightUnit;
}) {
  const width = 320;
  const height = 140;
  const padX = 12;
  const padY = 16;

  if (logs.length === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        No weigh-ins in this period
      </div>
    );
  }

  const weights = logs.map((log) => log.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = Math.max(max - min, 1);
  const points = logs.map((log, index) => {
    const x =
      logs.length === 1
        ? width / 2
        : padX + (index / (logs.length - 1)) * (width - padX * 2);
    const y = padY + (1 - (log.weight - min) / span) * (height - padY * 2);
    return { x, y, log };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
        <path
          d={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p) => (
          <circle key={p.log.id} cx={p.x} cy={p.y} r="3.5" fill="var(--primary)" />
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{formatDisplayDate(logs[0]!.loggedOn)}</span>
        <span>
          {formatWeight(min, unit)} – {formatWeight(max, unit)}
        </span>
        <span>{formatDisplayDate(logs[logs.length - 1]!.loggedOn)}</span>
      </div>
    </div>
  );
}

export function BodyWeightCard({ date }: BodyWeightCardProps) {
  const { user } = useAuth();
  const unit = user?.weightUnit ?? DEFAULT_WEIGHT_UNIT;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [trendOpen, setTrendOpen] = useState(false);
  const [rangeDays, setRangeDays] = useState<RangePreset>(90);
  const [editDate, setEditDate] = useState(date);
  const [editWeight, setEditWeight] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dayQuery = useQuery({
    queryKey: ['body-weight', date],
    queryFn: () => api.getBodyWeight(date) as Promise<BodyWeightLog | null>,
  });

  const from = shiftDate(date, -(rangeDays - 1));
  const rangeQuery = useQuery({
    queryKey: ['body-weight-range', from, date],
    enabled: trendOpen,
    queryFn: () => api.getBodyWeightRange(from, date) as Promise<BodyWeightLog[]>,
  });

  const log = dayQuery.data ?? null;
  const rangeLogs = rangeQuery.data ?? [];
  const historyLogs = useMemo(
    () => [...rangeLogs].sort((a, b) => b.loggedOn.localeCompare(a.loggedOn)),
    [rangeLogs],
  );

  useEffect(() => {
    if (!trendOpen) return;
    setEditDate(date);
    setEditWeight(log ? String(log.weight) : '');
  }, [trendOpen, date, log]);

  const stats = useMemo(() => {
    if (rangeLogs.length === 0) {
      return { average: null as number | null, latest: null as number | null, count: 0 };
    }
    const sum = rangeLogs.reduce((acc, item) => acc + item.weight, 0);
    return {
      average: sum / rangeLogs.length,
      latest: rangeLogs[rangeLogs.length - 1]?.weight ?? null,
      count: rangeLogs.length,
    };
  }, [rangeLogs]);

  const invalidateWeightQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['body-weight'] }),
      queryClient.invalidateQueries({ queryKey: ['body-weight-range'] }),
    ]);
  };

  const saveWeight = async () => {
    const weight = Number(draft);
    if (!Number.isFinite(weight) || weight <= 0) return;
    setSaving(true);
    try {
      const saved = (await api.upsertBodyWeight({
        loggedOn: date,
        weight,
        unit,
      })) as BodyWeightLog;
      queryClient.setQueryData(['body-weight', date], saved);
      await invalidateWeightQueries();
      setDraft('');
      showSuccess('Body weight saved');
    } catch (err) {
      showErrorFromUnknown(err);
    } finally {
      setSaving(false);
    }
  };

  const saveEditedWeight = async () => {
    const weight = Number(editWeight);
    if (!editDate || !Number.isFinite(weight) || weight <= 0) return;
    setEditSaving(true);
    try {
      await api.upsertBodyWeight({
        loggedOn: editDate,
        weight,
        unit,
      });
      await invalidateWeightQueries();
      showSuccess(`Saved weight for ${formatDisplayDate(editDate)}`);
    } catch (err) {
      showErrorFromUnknown(err);
    } finally {
      setEditSaving(false);
    }
  };

  const loadLogIntoEditor = (entry: BodyWeightLog) => {
    setEditDate(entry.loggedOn);
    setEditWeight(String(entry.weight));
  };

  const deleteLog = async (entry: BodyWeightLog) => {
    setDeletingId(entry.id);
    try {
      await api.deleteBodyWeight(entry.id);
      await invalidateWeightQueries();
      if (editDate === entry.loggedOn) {
        setEditWeight('');
      }
      showSuccess(`Removed ${formatDisplayDate(entry.loggedOn)}`);
    } catch (err) {
      showErrorFromUnknown(err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Card
        className="cursor-pointer transition-colors hover:bg-muted/30"
        onClick={() => setTrendOpen(true)}
      >
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-primary">Body weight</p>
            <ChartLine className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Open body weight trend</span>
          </div>
          {dayQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            <div
              className="flex items-end gap-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="body-weight-input" className="text-xs text-muted-foreground">
                  {formatDisplayDate(date)}
                </Label>
                <Input
                  id="body-weight-input"
                  className={cn(inputFieldClass, 'mb-0')}
                  inputMode="decimal"
                  placeholder={log ? String(log.weight) : `Weight (${unit})`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveWeight();
                  }}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={saving || !draft.trim()}
                onClick={() => void saveWeight()}
              >
                {saving ? 'Saving…' : log ? 'Update' : 'Save'}
              </Button>
            </div>
          )}
          {log && !draft && (
            <p className="text-sm tabular-nums text-muted-foreground">
              Logged: {formatWeight(log.weight, log.unit)}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={trendOpen} onOpenChange={setTrendOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Body weight</DialogTitle>
            <DialogDescription>
              Trend and history ending {formatDisplayDate(date)}. Edit any past day below.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            {([7, 30, 90, 365] as RangePreset[]).map((days) => (
              <Button
                key={days}
                type="button"
                size="sm"
                variant={rangeDays === days ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setRangeDays(days)}
              >
                {days === 365 ? '1y' : `${days}d`}
              </Button>
            ))}
          </div>

          {rangeQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading trend…</p>
          ) : (
            <>
              <BodyWeightChart logs={rangeLogs} unit={unit} />
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-md bg-muted/50 px-2 py-2">
                  <p className="text-[11px] text-muted-foreground">Average</p>
                  <p className="font-semibold tabular-nums">
                    {stats.average != null ? formatWeight(stats.average, unit) : '—'}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 px-2 py-2">
                  <p className="text-[11px] text-muted-foreground">Latest</p>
                  <p className="font-semibold tabular-nums">
                    {stats.latest != null ? formatWeight(stats.latest, unit) : '—'}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 px-2 py-2">
                  <p className="text-[11px] text-muted-foreground">Logs</p>
                  <p className="font-semibold tabular-nums">{stats.count}</p>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-medium">Add or edit a day</p>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-weight-date" className="text-xs text-muted-foreground">
                  Date
                </Label>
                <Input
                  id="edit-weight-date"
                  type="date"
                  className={cn(inputFieldClass, 'mb-0')}
                  value={editDate}
                  max={date}
                  onChange={(e) => {
                    setEditDate(e.target.value);
                    const existing = historyLogs.find((item) => item.loggedOn === e.target.value);
                    setEditWeight(existing ? String(existing.weight) : '');
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-weight-value" className="text-xs text-muted-foreground">
                  Weight ({unit})
                </Label>
                <Input
                  id="edit-weight-value"
                  className={cn(inputFieldClass, 'mb-0 w-24')}
                  inputMode="decimal"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveEditedWeight();
                  }}
                />
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={editSaving || !editDate || !editWeight.trim()}
              onClick={() => void saveEditedWeight()}
            >
              {editSaving ? 'Saving…' : 'Save day'}
            </Button>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-medium">History</p>
            {historyLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No weigh-ins in this range.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border">
                {historyLogs.map((entry, index) => (
                  <li
                    key={entry.id}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm',
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/50',
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => loadLogIntoEditor(entry)}
                    >
                      <span className="block font-medium">{formatDisplayDate(entry.loggedOn)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatWeight(entry.weight, entry.unit)}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-destructive"
                      disabled={deletingId === entry.id}
                      onClick={() => void deleteLog(entry)}
                    >
                      {deletingId === entry.id ? '…' : 'Delete'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTrendOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
