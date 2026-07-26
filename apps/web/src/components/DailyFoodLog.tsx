import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Loader2, Minus, X } from 'lucide-react';
import {
  DEFAULT_MEAL_COUNT,
  MAX_MEALS_PER_DAY,
  MIN_MEALS_PER_DAY,
  dayOfWeekFromDate,
  defaultMealName,
  formatCalendarDate,
  formatDisplayDate,
  formatMealTime,
  getClientTimeZone,
  groupFoodLogsByMeal,
  loggedAtForDate,
  mealRefFromEffectiveMeal,
  parseCalendarDate,
  type DayMeal,
  type EffectiveMealBlock,
  type EffectiveMealPlan,
  type Food,
  type FoodLogEntry,
  type GroupedFoodLogMeal,
  type WeekdayIndex,
} from '@calorie-tracker/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { cn, inputFieldClass, selectClass } from '@/lib/utils';
import { showErrorFromUnknown, showSuccess } from '@/lib/toast';
import { nutrientsForQuantity, sumNutrients } from '@calorie-tracker/client';
import { NutrientsSummary } from './NutrientsSummary';
import { FoodPicker } from './FoodPicker';
import { FoodQuantityFields } from './FoodQuantityFields';
import { api, localStore } from '../lib/client';
import { foodUnitOptions, GRAMS_UNIT } from '@/lib/food-units';

/** Stable across weekly → day-override remaps (meal UUID changes). */
function mealKey(meal: Pick<EffectiveMealBlock, 'mealIndex'>) {
  return `idx-${meal.mealIndex}`;
}

function previousCalendarDate(date: string): string {
  const d = parseCalendarDate(date);
  d.setDate(d.getDate() - 1);
  return formatCalendarDate(d);
}

type DailyFoodLogProps = {
  date: string;
  foodsMap: Map<string, Food>;
  logs: FoodLogEntry[];
  meals: EffectiveMealBlock[];
  autoMaterialize?: boolean;
  onMealsNeeded?: () => Promise<void>;
  showAddFood?: boolean;
  preselectedFoodId?: string;
};

export function DailyFoodLog({
  date,
  foodsMap,
  logs,
  meals,
  autoMaterialize = false,
  onMealsNeeded,
  showAddFood = true,
  preselectedFoodId,
}: DailyFoodLogProps) {
  const queryClient = useQueryClient();
  const materializedRef = useRef(false);
  const [activeMealId, setActiveMealId] = useState('');
  const [addFoodMealId, setAddFoodMealId] = useState('');
  const [foodId, setFoodId] = useState(preselectedFoodId ?? '');
  const [quantity, setQuantity] = useState('100');
  const [unit, setUnit] = useState(GRAMS_UNIT);
  const [dialogError, setDialogError] = useState('');
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [draftUnits, setDraftUnits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [busyLogIds, setBusyLogIds] = useState<Record<string, boolean>>({});
  const [selectedMealKey, setSelectedMealKey] = useState<string | null>(null);
  const [copyTargetKey, setCopyTargetKey] = useState<string | null>(null);
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [addMealError, setAddMealError] = useState('');

  const previousDate = previousCalendarDate(date);

  const foodsQuery = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.getFoods() as Promise<Food[]>,
  });

  const previousDayQuery = useQuery({
    queryKey: ['copy-meal-source', previousDate],
    queryFn: async () => {
      const [plan, dayLogs] = await Promise.all([
        api.getEffectiveMealPlans(previousDate) as Promise<EffectiveMealPlan>,
        api.getFoodLogs(previousDate) as Promise<FoodLogEntry[]>,
      ]);
      return groupFoodLogsByMeal(plan.meals, dayLogs);
    },
    enabled: !!copyTargetKey,
  });

  const grouped = groupFoodLogsByMeal(meals, logs);
  const pendingCount = logs.filter((log) => !log.deletedAt && log.status === 'pending').length;
  const selectedMeal =
    selectedMealKey != null
      ? (grouped.find((meal) => mealKey(meal) === selectedMealKey) ?? null)
      : null;
  const copyTargetMeal =
    copyTargetKey != null
      ? (grouped.find((meal) => mealKey(meal) === copyTargetKey) ?? null)
      : null;

  useEffect(() => {
    if (preselectedFoodId) {
      setFoodId(preselectedFoodId);
    }
  }, [preselectedFoodId]);

  useEffect(() => {
    const nextQty: Record<string, string> = {};
    const nextUnits: Record<string, string> = {};
    for (const log of logs) {
      nextQty[log.id] = String(log.quantity);
      nextUnits[log.id] = log.unit;
    }
    setDraftQuantities(nextQty);
    setDraftUnits(nextUnits);
  }, [logs]);

  useEffect(() => {
    materializedRef.current = false;
  }, [date]);

  useEffect(() => {
    if (!autoMaterialize || materializedRef.current || meals.length === 0) return;
    materializedRef.current = true;

    void api.materializeFoodLogsFromPlan(date).then(() => {
      void queryClient.invalidateQueries({ queryKey: ['food-logs', date] });
    });
  }, [autoMaterialize, date, meals.length, queryClient]);

  useEffect(() => {
    if (!activeMealId && meals.length > 0) {
      setActiveMealId(meals[0].id);
    }
  }, [meals, activeMealId]);

  const setLogBusy = (id: string, busy: boolean) => {
    setBusyLogIds((prev) => {
      if (busy) return { ...prev, [id]: true };
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const patchFoodLogsCache = (updater: (logs: FoodLogEntry[]) => FoodLogEntry[]) => {
    const previous = queryClient.getQueryData<FoodLogEntry[]>(['food-logs', date]);
    queryClient.setQueryData<FoodLogEntry[]>(['food-logs', date], (current) =>
      updater(current ?? []),
    );
    return previous;
  };

  const persistLogAmount = async (
    log: FoodLogEntry,
    overrides?: { quantity?: number; unit?: string },
  ) => {
    const qty =
      overrides?.quantity ??
      Number(draftQuantities[log.id] !== undefined ? draftQuantities[log.id] : log.quantity);
    const unit = overrides?.unit ?? draftUnits[log.id] ?? log.unit;
    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage('Enter a valid amount');
      setMessageIsError(true);
      setDraftQuantities((prev) => ({ ...prev, [log.id]: String(log.quantity) }));
      return;
    }
    if (qty === log.quantity && unit === log.unit) return;

    const previous = patchFoodLogsCache((current) =>
      current.map((entry) =>
        entry.id === log.id ? { ...entry, quantity: qty, unit } : entry,
      ),
    );
    setLogBusy(log.id, true);
    setMessage('');
    try {
      await api.updateFoodLog(log.id, { quantity: qty, unit });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['food-logs', date] }),
        queryClient.invalidateQueries({ queryKey: ['meal-plans-effective', date] }),
        queryClient.invalidateQueries({ queryKey: ['meal-plans', date] }),
      ]);
    } catch (error) {
      if (previous) queryClient.setQueryData(['food-logs', date], previous);
      setDraftQuantities((prev) => ({ ...prev, [log.id]: String(log.quantity) }));
      setDraftUnits((prev) => ({ ...prev, [log.id]: log.unit }));
      showErrorFromUnknown(error);
    } finally {
      setLogBusy(log.id, false);
    }
  };

  const confirmLog = async (id: string, { toast = true }: { toast?: boolean } = {}) => {
    const log = logs.find((entry) => entry.id === id);
    if (log) {
      const raw = draftQuantities[id];
      const qty = Number(raw);
      const unit = draftUnits[id] ?? log.unit;
      if (
        Number.isFinite(qty) &&
        qty > 0 &&
        (qty !== log.quantity || unit !== log.unit)
      ) {
        try {
          await api.updateFoodLog(id, { quantity: qty, unit });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['meal-plans-effective', date] }),
            queryClient.invalidateQueries({ queryKey: ['meal-plans', date] }),
          ]);
        } catch (error) {
          showErrorFromUnknown(error);
          throw error;
        }
      }
    }

    const previous = patchFoodLogsCache((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, status: 'confirmed' as const } : entry)),
    );
    setLogBusy(id, true);
    try {
      await api.confirmFoodLog(id);
      if (toast) showSuccess('Confirmed');
      await queryClient.invalidateQueries({ queryKey: ['food-logs', date] });
    } catch (error) {
      if (previous) queryClient.setQueryData(['food-logs', date], previous);
      showErrorFromUnknown(error);
      throw error;
    } finally {
      setLogBusy(id, false);
    }
  };

  const unconfirmLog = async (id: string) => {
    const previous = patchFoodLogsCache((current) =>
      current.map((log) => (log.id === id ? { ...log, status: 'pending' as const } : log)),
    );
    setLogBusy(id, true);
    try {
      await api.updateFoodLog(id, { status: 'pending' });
      showSuccess('Unconfirmed');
      await queryClient.invalidateQueries({ queryKey: ['food-logs', date] });
    } catch (error) {
      if (previous) queryClient.setQueryData(['food-logs', date], previous);
      showErrorFromUnknown(error);
    } finally {
      setLogBusy(id, false);
    }
  };

  const removeLog = async (id: string, meal: Pick<EffectiveMealBlock, 'mealIndex'>) => {
    // Keep this meal modal open — remove may fork weekly → day meals and change IDs.
    setSelectedMealKey(mealKey(meal));

    const previous = patchFoodLogsCache((current) =>
      current.map((log) =>
        log.id === id ? { ...log, deletedAt: new Date().toISOString() } : log,
      ),
    );
    setLogBusy(id, true);
    try {
      await api.deleteFoodLog(id);
      showSuccess('Removed');
      // Allow exit animation to finish before refetch settles the list.
      await new Promise((resolve) => window.setTimeout(resolve, 220));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['food-logs', date] }),
        queryClient.invalidateQueries({ queryKey: ['meal-plans-effective', date] }),
        queryClient.invalidateQueries({ queryKey: ['meal-plans', date] }),
      ]);
    } catch (error) {
      if (previous) queryClient.setQueryData(['food-logs', date], previous);
      showErrorFromUnknown(error);
    } finally {
      setLogBusy(id, false);
    }
  };

  const confirmMeal = async (mealLogs: FoodLogEntry[]) => {
    const pending = mealLogs.filter((log) => log.status === 'pending');
    if (pending.length === 0) return;

    setSaving(true);
    setMessage('');
    try {
      for (const log of pending) {
        await confirmLog(log.id, { toast: false });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['meal-plans-effective', date] }),
        queryClient.invalidateQueries({ queryKey: ['meal-plans', date] }),
      ]);

      showSuccess('Meal confirmed');
      await queryClient.invalidateQueries({ queryKey: ['food-logs', date] });
      closeMealDetail();
    } catch (error) {
      showErrorFromUnknown(error);
    } finally {
      setSaving(false);
    }
  };

  const confirmAll = async () => {
    const pending = logs.filter((log) => !log.deletedAt && log.status === 'pending');
    setSaving(true);
    try {
      for (const log of pending) {
        await confirmLog(log.id, { toast: false });
      }
      showSuccess('All foods confirmed');
    } catch {
      // error toast already shown in confirmLog
    } finally {
      setSaving(false);
    }
  };

  const selectMealForAdd = (meal: EffectiveMealBlock) => {
    setActiveMealId(meal.id);
    setAddFoodMealId(meal.id);
    setFoodId(preselectedFoodId ?? '');
    setQuantity('100');
    setUnit(GRAMS_UNIT);
    setDialogError('');
  };

  const closeAddFoodDialog = () => {
    setAddFoodMealId('');
    setUnit(GRAMS_UNIT);
    setDialogError('');
  };

  const openMealDetail = (meal: Pick<EffectiveMealBlock, 'mealIndex'>) => {
    setSelectedMealKey(mealKey(meal));
  };

  const closeMealDetail = () => {
    setSelectedMealKey(null);
  };

  const openCopyMealDialog = (meal: Pick<EffectiveMealBlock, 'mealIndex'>) => {
    setCopyTargetKey(mealKey(meal));
  };

  const closeCopyMealDialog = () => {
    setCopyTargetKey(null);
  };

  const invalidateDayQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['food-logs', date] }),
      queryClient.invalidateQueries({ queryKey: ['meal-plans-effective', date] }),
      queryClient.invalidateQueries({ queryKey: ['meal-plans', date] }),
    ]);
  };

  const ensureDayOverride = async () => {
    const isWeekly = meals.some((meal) => meal.source === 'weekly');
    if (!isWeekly) return;
    await api.materializeWeeklyMealPlan(date);
  };

  const resolveMealForLogging = async (meal: EffectiveMealBlock): Promise<EffectiveMealBlock> => {
    // If this day already has a day override, always log against current day meals.
    // If still on the weekly template, keep weekly meal ids — do not rematerialize mid-add.
    if (meal.source === 'override') {
      const plan = (await api.getEffectiveMealPlans(date)) as EffectiveMealPlan;
      const resolved =
        plan.meals.find((item) => item.id === meal.id) ??
        plan.meals.find((item) => item.mealIndex === meal.mealIndex);
      if (!resolved) throw new Error('Meal not found for this day');
      return resolved;
    }
    return meal;
  };

  const openAddMealDialog = () => {
    setNewMealName(defaultMealName(meals.length));
    setAddMealError('');
    setAddMealOpen(true);
  };

  const closeAddMealDialog = () => {
    setAddMealOpen(false);
    setAddMealError('');
  };

  const addMeal = async () => {
    const name = newMealName.trim();
    if (!name) {
      setAddMealError('Meal name is required');
      return;
    }
    if (meals.length >= MAX_MEALS_PER_DAY) {
      setAddMealError(`Maximum of ${MAX_MEALS_PER_DAY} meals`);
      return;
    }

    setSaving(true);
    setAddMealError('');
    try {
      await ensureDayOverride();
      const dayMeals = (await api.getDayMeals(date)) as DayMeal[];
      const nextIndex =
        dayMeals.reduce((max, meal) => Math.max(max, meal.mealIndex), -1) + 1;
      await api.createDayMeal({
        planDate: date,
        mealIndex: nextIndex,
        name,
      });
      await api.materializeFoodLogsFromPlan(date);
      await invalidateDayQueries();
      closeAddMealDialog();
      showSuccess('Meal added');
    } catch (error) {
      setAddMealError(error instanceof Error ? error.message : 'Failed to add meal');
    } finally {
      setSaving(false);
    }
  };

  const removeMeal = async (meal: EffectiveMealBlock) => {
    if (meals.length <= MIN_MEALS_PER_DAY) {
      showErrorFromUnknown(new Error(`Keep at least ${MIN_MEALS_PER_DAY} meal`));
      return;
    }

    setSaving(true);
    try {
      await ensureDayOverride();
      const dayMeals = (await api.getDayMeals(date)) as DayMeal[];
      const target =
        dayMeals.find((item) => item.id === meal.id) ??
        dayMeals.find((item) => item.mealIndex === meal.mealIndex);
      if (!target) throw new Error('Meal not found');

      await api.deleteDayMeal(target.id);
      await api.materializeFoodLogsFromPlan(date);
      if (selectedMealKey === mealKey(meal)) closeMealDetail();
      await invalidateDayQueries();
      showSuccess('Meal removed');
    } catch (error) {
      showErrorFromUnknown(error);
    } finally {
      setSaving(false);
    }
  };

  const copyMealFrom = async (sourceDate: string, sourceMeal: GroupedFoodLogMeal) => {
    if (!copyTargetMeal) return;
    const sourceLogs = sourceMeal.logs.filter((log) => !log.deletedAt);
    if (sourceLogs.length === 0) {
      showErrorFromUnknown(new Error('That meal has no foods to copy'));
      return;
    }

    setSaving(true);
    try {
      const target = await resolveMealForLogging(copyTargetMeal);
      for (const log of sourceLogs) {
        await api.createFoodLog({
          loggedAt: loggedAtForDate(date, target.mealTime, getClientTimeZone()),
          ...mealRefFromEffectiveMeal(target),
          foodId: log.foodId,
          quantity: log.quantity,
          unit: log.unit,
          status: 'pending' as const,
        });
      }
      await invalidateDayQueries();
      closeCopyMealDialog();
      setSelectedMealKey(mealKey(target));
      showSuccess(
        `Copied ${sourceLogs.length} food${sourceLogs.length === 1 ? '' : 's'} from ${sourceMeal.name}${
          sourceDate !== date ? ` (${sourceDate})` : ''
        }`,
      );
    } catch (error) {
      showErrorFromUnknown(error);
    } finally {
      setSaving(false);
    }
  };

  const addFoodMeal = meals.find((meal) => meal.id === addFoodMealId);

  const addFood = async () => {
    const selectedMeal = meals.find((item) => item.id === activeMealId);
    if (!selectedMeal || !foodId) {
      setDialogError('Select a food');
      return;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setDialogError('Enter a valid amount');
      return;
    }

    setSaving(true);
    setDialogError('');
    try {
      const meal = await resolveMealForLogging(selectedMeal);
      const input = {
        loggedAt: loggedAtForDate(date, meal.mealTime, getClientTimeZone()),
        ...mealRefFromEffectiveMeal(meal),
        foodId,
        quantity: qty,
        unit,
        status: 'pending' as const,
      };

      // Prefer the API so the log is persisted server-side before we refresh the list.
      // Offline local-store sync was succeeding locally then failing validation on push,
      // so the subsequent refetch wiped the food from the UI.
      const created = (await api.createFoodLog(input)) as FoodLogEntry;

      queryClient.setQueryData<FoodLogEntry[]>(['food-logs', date], (current) => {
        const existing = current ?? [];
        if (existing.some((log) => log.id === created.id)) return existing;
        return [...existing, created];
      });
      setSelectedMealKey(mealKey(meal));

      await queryClient.refetchQueries({ queryKey: ['food-logs', date] });
      showSuccess('Food logged');
      setQuantity('100');
      setUnit(GRAMS_UNIT);
      setFoodId('');
      closeAddFoodDialog();
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : 'Failed to log food');
    } finally {
      setSaving(false);
    }
  };

  const renderMealFoodList = (meal: GroupedFoodLogMeal) => {
    if (meal.logs.length === 0) {
      return (
        <p className="text-sm italic text-muted-foreground">Nothing planned for this meal</p>
      );
    }

    return (
      <ul className="space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {meal.logs.map((log, index) => {
            const food = foodsMap.get(log.foodId);
            const isPending = log.status === 'pending';
            const isBusy = !!busyLogIds[log.id];
            const unitOptions = foodUnitOptions(food);
            const currentUnit = draftUnits[log.id] ?? log.unit;
            const itemNutrients = nutrientsForQuantity(
              food,
              draftQuantities[log.id],
              log.quantity,
              currentUnit,
            );
            return (
              <motion.li
                key={log.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{
                  layout: { type: 'spring', stiffness: 420, damping: 36 },
                  opacity: { duration: 0.18 },
                  y: { duration: 0.18 },
                }}
                className={cn(
                  'overflow-hidden rounded-lg border border-border px-3 py-2',
                  index % 2 === 0 ? 'bg-background' : 'bg-accent',
                  isPending && 'border-l-2 border-l-primary',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{food?.name ?? 'Unknown food'}</p>
                      {isPending && <Badge variant="secondary">Planned</Badge>}
                    </div>
                    <NutrientsSummary nutrients={itemNutrients} className="mt-0.5" />
                    {isPending && (
                      <p className="text-xs text-primary">Confirm when eaten</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        className={cn(inputFieldClass, 'w-24')}
                        inputMode="decimal"
                        aria-label="Amount"
                        value={draftQuantities[log.id] ?? String(log.quantity)}
                        onChange={(e) =>
                          setDraftQuantities((prev) => ({
                            ...prev,
                            [log.id]: e.target.value,
                          }))
                        }
                        onBlur={() => void persistLogAmount(log)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        disabled={isBusy}
                      />
                      <select
                        className={cn(selectClass, 'mb-0 h-9 w-auto min-w-[5.5rem]')}
                        aria-label="Unit"
                        value={currentUnit}
                        disabled={isBusy}
                        onChange={(e) => {
                          const nextUnit = e.target.value;
                          setDraftUnits((prev) => ({
                            ...prev,
                            [log.id]: nextUnit,
                          }));
                          const qty = Number(draftQuantities[log.id] ?? log.quantity);
                          void persistLogAmount(log, {
                            quantity: Number.isFinite(qty) ? qty : log.quantity,
                            unit: nextUnit,
                          });
                        }}
                      >
                        {(unitOptions.some((option) => option.value === currentUnit)
                          ? unitOptions
                          : [
                              {
                                value: currentUnit,
                                label: currentUnit,
                                gramsPerUnit: 1,
                              },
                              ...unitOptions,
                            ]
                        ).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isBusy ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        {isPending ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-green-600 hover:bg-green-600/10 hover:text-green-600"
                            aria-label="Confirm food"
                            onClick={() => void confirmLog(log.id)}
                          >
                            <Check className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:bg-muted"
                            aria-label="Unconfirm food"
                            onClick={() => void unconfirmLog(log.id)}
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Remove food"
                          onClick={() => void removeLog(log.id, meal)}
                        >
                          <Minus className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    );
  };

  if (meals.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            Set up your meal schedule before logging food. Each day uses your weekly template unless
            customized.
          </p>
          <Button className="w-full" size="lg" onClick={() => void onMealsNeeded?.()}>
            Set up {DEFAULT_MEAL_COUNT} default meals
          </Button>
          <Button variant="link" className="w-full" asChild>
            <Link to="/weekly-meal-plans">Edit weekly meal schedule</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {message && (
        <p className={cn('mb-3 text-sm', messageIsError ? 'text-destructive' : 'text-primary')}>
          {message}
        </p>
      )}

      {pendingCount > 0 && (
        <Button className="mb-4 w-full" size="lg" onClick={() => void confirmAll()} disabled={saving}>
          Confirm all ({pendingCount})
        </Button>
      )}

      <div className="space-y-4">
        {grouped.map((meal) => {
          const mealPendingCount = meal.logs.filter((log) => log.status === 'pending').length;
          const mealFullyConfirmed = meal.logs.length > 0 && mealPendingCount === 0;
          const mealNutrients = sumNutrients(
            meal.logs.map((log) => {
              const food = foodsMap.get(log.foodId);
              return nutrientsForQuantity(
                food,
                draftQuantities[log.id],
                log.quantity,
                draftUnits[log.id] ?? log.unit,
              );
            }),
          );

          return (
            <Card
              key={mealKey(meal)}
              className={cn(
                mealFullyConfirmed &&
                  'bg-primary/5 shadow-[0_0_28px_color-mix(in_oklab,var(--primary)_35%,transparent)] ring-1 ring-primary/40',
              )}
            >
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-row items-start justify-between gap-2 text-left"
                    onClick={() => openMealDetail(meal)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{meal.name}</CardTitle>
                        {mealFullyConfirmed && (
                          <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                            Confirmed
                          </Badge>
                        )}
                        {mealPendingCount > 0 && (
                          <Badge variant="secondary">{mealPendingCount} planned</Badge>
                        )}
                      </div>
                      {meal.logs.length > 0 ? (
                        <NutrientsSummary nutrients={mealNutrients} className="mt-1" />
                      ) : (
                        <p className="mt-1 text-sm italic text-muted-foreground">No foods yet</p>
                      )}
                    </div>
                    {formatMealTime(meal.mealTime) && (
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {formatMealTime(meal.mealTime)}
                      </span>
                    )}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => openCopyMealDialog(meal)}
                  >
                    <Copy className="size-3.5" />
                    Copy meal
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={saving || meals.length <= MIN_MEALS_PER_DAY}
                    onClick={() => void removeMeal(meal)}
                  >
                    Remove meal
                  </Button>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="mt-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={saving || meals.length >= MAX_MEALS_PER_DAY}
          onClick={openAddMealDialog}
        >
          Add meal
        </Button>
      </div>

      <Dialog
        open={selectedMeal != null}
        onOpenChange={(open) => {
          if (!open) closeMealDetail();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selectedMeal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span>{selectedMeal.name}</span>
                  {selectedMeal.logs.length > 0 &&
                    selectedMeal.logs.every((log) => log.status === 'confirmed') && (
                      <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                        Confirmed
                      </Badge>
                    )}
                </DialogTitle>
                <DialogDescription>
                  {formatMealTime(selectedMeal.mealTime)
                    ? `${formatMealTime(selectedMeal.mealTime)} · ${formatDisplayDate(date)}`
                    : formatDisplayDate(date)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {selectedMeal.logs.filter((log) => log.status === 'pending').length > 0 && (
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => void confirmMeal(selectedMeal.logs)}
                    disabled={saving}
                  >
                    Confirm meal (
                    {selectedMeal.logs.filter((log) => log.status === 'pending').length})
                  </Button>
                )}

                {renderMealFoodList(selectedMeal)}

                {showAddFood && (
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => selectMealForAdd(selectedMeal)}
                  >
                    Add food to this meal
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={copyTargetMeal != null}
        onOpenChange={(open) => {
          if (!open) closeCopyMealDialog();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {copyTargetMeal && (
            <>
              <DialogHeader>
                <DialogTitle>Copy into {copyTargetMeal.name}</DialogTitle>
                <DialogDescription>
                  Choose a meal from today or yesterday. Foods are added as planned (not confirmed).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Today</p>
                  {grouped.filter((meal) => mealKey(meal) !== mealKey(copyTargetMeal)).length ===
                  0 ? (
                    <p className="text-sm text-muted-foreground">No other meals today</p>
                  ) : (
                    <div className="space-y-2">
                      {grouped
                        .filter((meal) => mealKey(meal) !== mealKey(copyTargetMeal))
                        .map((meal) => {
                          const count = meal.logs.filter((log) => !log.deletedAt).length;
                          return (
                            <Button
                              key={mealKey(meal)}
                              type="button"
                              variant="outline"
                              className="h-auto w-full justify-between px-3 py-2"
                              disabled={saving || count === 0}
                              onClick={() => void copyMealFrom(date, meal)}
                            >
                              <span className="truncate text-left">
                                {meal.name}
                                {formatMealTime(meal.mealTime)
                                  ? ` · ${formatMealTime(meal.mealTime)}`
                                  : ''}
                              </span>
                              <span className="shrink-0 text-muted-foreground">
                                {count === 0 ? 'Empty' : `${count} food${count === 1 ? '' : 's'}`}
                              </span>
                            </Button>
                          );
                        })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Yesterday ({previousDate})</p>
                  {previousDayQuery.isLoading ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading…
                    </p>
                  ) : previousDayQuery.isError ? (
                    <p className="text-sm text-destructive">Could not load yesterday’s meals</p>
                  ) : (previousDayQuery.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No meals yesterday</p>
                  ) : (
                    <div className="space-y-2">
                      {(previousDayQuery.data ?? []).map((meal) => {
                        const count = meal.logs.filter((log) => !log.deletedAt).length;
                        return (
                          <Button
                            key={`prev-${mealKey(meal)}`}
                            type="button"
                            variant="outline"
                            className="h-auto w-full justify-between px-3 py-2"
                            disabled={saving || count === 0}
                            onClick={() => void copyMealFrom(previousDate, meal)}
                          >
                            <span className="truncate text-left">
                              {meal.name}
                              {formatMealTime(meal.mealTime)
                                ? ` · ${formatMealTime(meal.mealTime)}`
                                : ''}
                            </span>
                            <span className="shrink-0 text-muted-foreground">
                              {count === 0 ? 'Empty' : `${count} food${count === 1 ? '' : 's'}`}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={addMealOpen}
        onOpenChange={(open) => {
          if (!open) closeAddMealDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add meal</DialogTitle>
            <DialogDescription>Name this meal for {formatDisplayDate(date)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-meal-name" className="text-sm font-medium">
                Meal name
              </Label>
              <Input
                id="new-meal-name"
                className={cn(inputFieldClass, 'mb-0')}
                value={newMealName}
                onChange={(e) => setNewMealName(e.target.value)}
                placeholder="e.g. Breakfast"
                autoFocus
              />
            </div>
            {addMealError && <p className="text-sm text-destructive">{addMealError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAddMealDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void addMeal()} disabled={saving}>
              {saving ? 'Adding…' : 'Add meal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAddFood && (
        <Dialog
          open={!!addFoodMealId}
          onOpenChange={(open) => {
            if (!open) closeAddFoodDialog();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add food to {addFoodMeal?.name ?? 'meal'}</DialogTitle>
              <DialogDescription>Logging for {formatDisplayDate(date)}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="log-food-select" className="text-sm font-medium">
                  Food
                </Label>
                <FoodPicker
                  id="log-food-select"
                  foods={foodsQuery.data ?? []}
                  value={foodId}
                  onChange={(nextId) => {
                    setFoodId(nextId);
                    setUnit(GRAMS_UNIT);
                    setQuantity('100');
                  }}
                />
              </div>

              <FoodQuantityFields
                food={(foodsQuery.data ?? []).find((food) => food.id === foodId)}
                quantity={quantity}
                unit={unit}
                onQuantityChange={setQuantity}
                onUnitChange={(nextUnit) => {
                  setUnit(nextUnit);
                  setQuantity(nextUnit === GRAMS_UNIT ? '100' : '1');
                }}
                quantityId="log-food-quantity"
                unitId="log-food-unit"
              />

              {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}

              <Button variant="link" className="h-auto p-0" asChild>
                <Link to="/foods/search">Search or add new foods</Link>
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAddFoodDialog}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void addFood()} disabled={saving}>
                {saving ? 'Adding…' : 'Log food'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export async function ensureWeeklyMealsForDate(date: string) {
  const dayOfWeek = dayOfWeekFromDate(date);
  const userId = api.getUserId();

  if (userId) {
    const current = await localStore.localGetWeeklyMeals(userId);
    const dayMeals = current.filter((meal) => meal.dayOfWeek === dayOfWeek);
    if (dayMeals.length >= DEFAULT_MEAL_COUNT) return;

    const createdMeals = Array.from({ length: DEFAULT_MEAL_COUNT - dayMeals.length }, (_, offset) => ({
      id: crypto.randomUUID(),
      mealIndex: dayMeals.length + offset,
      name: defaultMealName(dayMeals.length + offset),
    }));

    await localStore.localSetWeeklyMealCount(
      userId,
      dayOfWeek as WeekdayIndex,
      DEFAULT_MEAL_COUNT,
      createdMeals,
    );
    return;
  }

  await api.setWeeklyMealCount({ dayOfWeek, mealCount: DEFAULT_MEAL_COUNT });
}
