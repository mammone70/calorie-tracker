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
import { api } from '../lib/client';
import {
  formatCalendarDate,
  formatDisplayDate,
  parseCalendarDate,
  type WaistCircumferenceLog,
} from '@calorie-tracker/shared';
import { cn, inputFieldClass } from '@/lib/utils';
import { showErrorFromUnknown, showSuccess } from '@/lib/toast';

type WaistCircumferenceCardProps = {
  date: string;
};

type RangePreset = 90 | 180 | 365 | 730;

function shiftDate(date: string, days: number): string {
  const d = parseCalendarDate(date);
  d.setDate(d.getDate() + days);
  return formatCalendarDate(d);
}

/** Format fractional inches without trailing zeros (e.g. 34.5, 34.125). */
function formatInches(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return `${rounded} in`;
}

function WaistChart({ logs }: { logs: WaistCircumferenceLog[] }) {
  const width = 320;
  const height = 140;
  const padX = 12;
  const padY = 16;

  if (logs.length === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        No measurements in this period
      </div>
    );
  }

  const values = logs.map((log) => log.inches);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.25);
  const points = logs.map((log, index) => {
    const x =
      logs.length === 1
        ? width / 2
        : padX + (index / (logs.length - 1)) * (width - padX * 2);
    const y = padY + (1 - (log.inches - min) / span) * (height - padY * 2);
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
          {formatInches(min)} – {formatInches(max)}
        </span>
        <span>{formatDisplayDate(logs[logs.length - 1]!.loggedOn)}</span>
      </div>
    </div>
  );
}

export function WaistCircumferenceCard({ date }: WaistCircumferenceCardProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [trendOpen, setTrendOpen] = useState(false);
  const [rangeDays, setRangeDays] = useState<RangePreset>(365);
  const [editDate, setEditDate] = useState(date);
  const [editInches, setEditInches] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dayQuery = useQuery({
    queryKey: ['waist-circumference', date],
    queryFn: () => api.getWaistCircumference(date) as Promise<WaistCircumferenceLog | null>,
  });

  const latestQuery = useQuery({
    queryKey: ['waist-circumference-latest', date],
    queryFn: () =>
      api.getLatestWaistCircumference(date) as Promise<WaistCircumferenceLog | null>,
  });

  const from = shiftDate(date, -(rangeDays - 1));
  const rangeQuery = useQuery({
    queryKey: ['waist-circumference-range', from, date],
    enabled: trendOpen,
    queryFn: () =>
      api.getWaistCircumferenceRange(from, date) as Promise<WaistCircumferenceLog[]>,
  });

  const log = dayQuery.data ?? null;
  const latest = latestQuery.data ?? null;
  const rangeLogs = rangeQuery.data ?? [];
  const historyLogs = useMemo(
    () => [...rangeLogs].sort((a, b) => b.loggedOn.localeCompare(a.loggedOn)),
    [rangeLogs],
  );

  useEffect(() => {
    if (!trendOpen) return;
    setEditDate(date);
    setEditInches(log ? String(log.inches) : '');
  }, [trendOpen, date, log]);

  const stats = useMemo(() => {
    if (rangeLogs.length === 0) {
      return { average: null as number | null, latest: null as number | null, count: 0 };
    }
    const sum = rangeLogs.reduce((acc, item) => acc + item.inches, 0);
    return {
      average: sum / rangeLogs.length,
      latest: rangeLogs[rangeLogs.length - 1]?.inches ?? null,
      count: rangeLogs.length,
    };
  }, [rangeLogs]);

  const invalidateWaistQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['waist-circumference'] }),
      queryClient.invalidateQueries({ queryKey: ['waist-circumference-latest'] }),
      queryClient.invalidateQueries({ queryKey: ['waist-circumference-range'] }),
    ]);
  };

  const saveInches = async () => {
    const inches = Number(draft);
    if (!Number.isFinite(inches) || inches <= 0) return;
    setSaving(true);
    try {
      const saved = (await api.upsertWaistCircumference({
        loggedOn: date,
        inches,
      })) as WaistCircumferenceLog;
      queryClient.setQueryData(['waist-circumference', date], saved);
      await invalidateWaistQueries();
      setDraft('');
      showSuccess('Waist circumference saved');
    } catch (err) {
      showErrorFromUnknown(err);
    } finally {
      setSaving(false);
    }
  };

  const saveEditedInches = async () => {
    const inches = Number(editInches);
    if (!editDate || !Number.isFinite(inches) || inches <= 0) return;
    setEditSaving(true);
    try {
      await api.upsertWaistCircumference({
        loggedOn: editDate,
        inches,
      });
      await invalidateWaistQueries();
      showSuccess(`Saved waist for ${formatDisplayDate(editDate)}`);
    } catch (err) {
      showErrorFromUnknown(err);
    } finally {
      setEditSaving(false);
    }
  };

  const loadLogIntoEditor = (entry: WaistCircumferenceLog) => {
    setEditDate(entry.loggedOn);
    setEditInches(String(entry.inches));
  };

  const deleteLog = async (entry: WaistCircumferenceLog) => {
    setDeletingId(entry.id);
    try {
      await api.deleteWaistCircumference(entry.id);
      await invalidateWaistQueries();
      if (editDate === entry.loggedOn) {
        setEditInches('');
      }
      showSuccess(`Removed ${formatDisplayDate(entry.loggedOn)}`);
    } catch (err) {
      showErrorFromUnknown(err);
    } finally {
      setDeletingId(null);
    }
  };

  const lastKnownLabel =
    latest && (!log || latest.loggedOn !== log.loggedOn)
      ? `Last: ${formatInches(latest.inches)} · ${formatDisplayDate(latest.loggedOn)}`
      : null;

  return (
    <>
      <Card
        className="cursor-pointer transition-colors hover:bg-muted/30"
        onClick={() => setTrendOpen(true)}
      >
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-primary">Waist</p>
            <ChartLine className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Open waist circumference trend</span>
          </div>
          {dayQuery.isLoading || latestQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            <div
              className="flex items-end gap-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="waist-input" className="text-xs text-muted-foreground">
                  {formatDisplayDate(date)}
                </Label>
                <Input
                  id="waist-input"
                  className={cn(inputFieldClass, 'mb-0')}
                  inputMode="decimal"
                  step="0.125"
                  placeholder={log ? String(log.inches) : 'Inches'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveInches();
                  }}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={saving || !draft.trim()}
                onClick={() => void saveInches()}
              >
                {saving ? 'Saving…' : log ? 'Update' : 'Save'}
              </Button>
            </div>
          )}
          {log && !draft ? (
            <p className="text-sm tabular-nums text-muted-foreground">
              Logged: {formatInches(log.inches)}
            </p>
          ) : lastKnownLabel && !draft ? (
            <p className="text-sm tabular-nums text-muted-foreground">{lastKnownLabel}</p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={trendOpen} onOpenChange={setTrendOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Waist circumference</DialogTitle>
            <DialogDescription>
              Occasional measurements in inches. Trend ending {formatDisplayDate(date)}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            {(
              [
                [90, '90d'],
                [180, '6mo'],
                [365, '1y'],
                [730, '2y'],
              ] as const
            ).map(([days, label]) => (
              <Button
                key={days}
                type="button"
                size="sm"
                variant={rangeDays === days ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setRangeDays(days)}
              >
                {label}
              </Button>
            ))}
          </div>

          {rangeQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading trend…</p>
          ) : (
            <>
              <WaistChart logs={rangeLogs} />
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-md bg-muted/50 px-2 py-2">
                  <p className="text-[11px] text-muted-foreground">Average</p>
                  <p className="font-semibold tabular-nums">
                    {stats.average != null ? formatInches(stats.average) : '—'}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 px-2 py-2">
                  <p className="text-[11px] text-muted-foreground">Latest</p>
                  <p className="font-semibold tabular-nums">
                    {stats.latest != null ? formatInches(stats.latest) : '—'}
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
                <Label htmlFor="edit-waist-date" className="text-xs text-muted-foreground">
                  Date
                </Label>
                <Input
                  id="edit-waist-date"
                  type="date"
                  className={cn(inputFieldClass, 'mb-0')}
                  value={editDate}
                  max={date}
                  onChange={(e) => {
                    setEditDate(e.target.value);
                    const existing = historyLogs.find((item) => item.loggedOn === e.target.value);
                    setEditInches(existing ? String(existing.inches) : '');
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-waist-value" className="text-xs text-muted-foreground">
                  Inches
                </Label>
                <Input
                  id="edit-waist-value"
                  className={cn(inputFieldClass, 'mb-0 w-24')}
                  inputMode="decimal"
                  step="0.125"
                  value={editInches}
                  onChange={(e) => setEditInches(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveEditedInches();
                  }}
                />
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={editSaving || !editDate || !editInches.trim()}
              onClick={() => void saveEditedInches()}
            >
              {editSaving ? 'Saving…' : 'Save day'}
            </Button>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-medium">History</p>
            {historyLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No measurements in this range.</p>
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
                        {formatInches(entry.inches)}
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
