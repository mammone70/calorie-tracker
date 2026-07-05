import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MacroProgress } from '../components/MacroProgress';
import { PageHeader } from '../components/PageHeader';
import { cn, selectClass } from '@/lib/utils';
import { computeNutrients, sumNutrients } from '@calorie-tracker/client';
import { api, localStore } from '../lib/client';
import {
  DEFAULT_MEAL_COUNT,
  MAX_MEALS_PER_DAY,
  MIN_MEALS_PER_DAY,
  WEEKDAYS,
  defaultMealName,
  formatMealTime,
  formatNutrientsSummary,
  normalizeMealTime,
  type Food,
  type WeekdayIndex,
  type WeeklyMeal,
  type WeeklyMealPlanEntry,
  type WeeklyMacroTarget,
} from '@calorie-tracker/shared';

function hasWeeklyMacroTarget(target: WeeklyMacroTarget | undefined) {
  if (!target) return false;
  return (
    target.calories > 0 || target.proteinG > 0 || target.fatG > 0 || target.carbsG > 0
  );
}

type WeeklyMealPlansPageProps = {
  forUserId?: string;
  backTo?: string;
  title?: string;
  targetsLink?: string;
};

export function WeeklyMealPlansPage({
  forUserId,
  backTo = '/settings',
  title = 'Weekly Meal Plans',
  targetsLink = '/weekly-targets',
}: WeeklyMealPlansPageProps = {}) {
  const adminMode = !!forUserId;
  const mealsQueryKey = ['weekly-meals', forUserId ?? 'self'];
  const entriesQueryKey = ['weekly-meal-plans', forUserId ?? 'self'];
  const foodsQueryKey = ['foods', forUserId ?? 'self'];
  const targetsQueryKey = ['weekly-macro-targets', forUserId ?? 'self'];

  const queryClient = useQueryClient();
  const [activeDay, setActiveDay] = useState<WeekdayIndex>(0);
  const [foodId, setFoodId] = useState('');
  const [activeMealId, setActiveMealId] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mealNames, setMealNames] = useState<Record<string, string>>({});
  const [entryQuantities, setEntryQuantities] = useState<Record<string, string>>({});
  const [initializedDays, setInitializedDays] = useState<Set<number>>(new Set());

  const mealsQuery = useQuery({
    queryKey: mealsQueryKey,
    queryFn: () => api.getWeeklyMeals(undefined, { forUserId }) as Promise<WeeklyMeal[]>,
  });

  const entriesQuery = useQuery({
    queryKey: entriesQueryKey,
    queryFn: () => api.getWeeklyMealPlans(undefined, { forUserId }) as Promise<WeeklyMealPlanEntry[]>,
  });

  const foodsQuery = useQuery({
    queryKey: foodsQueryKey,
    queryFn: () => api.getFoods({ forUserId }) as Promise<Food[]>,
  });

  const weeklyTargetsQuery = useQuery({
    queryKey: targetsQueryKey,
    queryFn: () => api.getWeeklyMacroTargets({ forUserId }) as Promise<WeeklyMacroTarget[]>,
  });

  const foodsMap = useMemo(
    () => new Map((foodsQuery.data ?? []).map((food) => [food.id, food])),
    [foodsQuery.data],
  );

  const mealsByDay = useMemo(() => {
    const grouped = WEEKDAYS.map(() => [] as WeeklyMeal[]);
    for (const meal of mealsQuery.data ?? []) {
      grouped[meal.dayOfWeek].push(meal);
    }
    for (const dayMeals of grouped) {
      dayMeals.sort((a, b) => a.mealIndex - b.mealIndex);
    }
    return grouped;
  }, [mealsQuery.data]);

  const entriesByMealId = useMemo(() => {
    const map = new Map<string, WeeklyMealPlanEntry[]>();
    for (const entry of entriesQuery.data ?? []) {
      const list = map.get(entry.weeklyMealId) ?? [];
      list.push(entry);
      map.set(entry.weeklyMealId, list);
    }
    return map;
  }, [entriesQuery.data]);

  const activeMeals = mealsByDay[activeDay];

  const dayTarget = weeklyTargetsQuery.data?.find((target) => target.dayOfWeek === activeDay);

  const planned = useMemo(() => {
    const entries: WeeklyMealPlanEntry[] = [];
    for (const meal of activeMeals) {
      entries.push(...(entriesByMealId.get(meal.id) ?? []));
    }

    return sumNutrients(
      entries.map((entry) => {
        const food = foodsMap.get(entry.foodId);
        if (!food) return { calories: 0, protein: 0, fat: 0, carbs: 0 };
        const raw = entryQuantities[entry.id] ?? String(entry.quantity);
        const qty = Number(raw);
        if (!Number.isFinite(qty) || qty <= 0) {
          return { calories: 0, protein: 0, fat: 0, carbs: 0 };
        }
        return computeNutrients(food.nutrientsPer100g, qty);
      }),
    );
  }, [activeMeals, entriesByMealId, foodsMap, entryQuantities]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const meal of mealsQuery.data ?? []) {
      next[meal.id] = meal.name;
    }
    setMealNames(next);
  }, [mealsQuery.data]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const entry of entriesQuery.data ?? []) {
      next[entry.id] = String(entry.quantity);
    }
    setEntryQuantities(next);
  }, [entriesQuery.data]);

  useEffect(() => {
    if (mealsQuery.isLoading || initializedDays.has(activeDay)) return;
    if (activeMeals.length > 0) {
      setInitializedDays((prev) => new Set(prev).add(activeDay));
      return;
    }

    void ensureDefaultMeals(activeDay);
  }, [activeDay, activeMeals.length, mealsQuery.isLoading, initializedDays]);

  useEffect(() => {
    if (!activeMealId && activeMeals.length > 0) {
      setActiveMealId(activeMeals[0].id);
    }
    if (activeMealId && !activeMeals.some((meal) => meal.id === activeMealId)) {
      setActiveMealId(activeMeals[0]?.id ?? '');
    }
  }, [activeMeals, activeMealId]);

  const ensureDefaultMeals = async (dayOfWeek: WeekdayIndex) => {
    setSaving(true);
    try {
      await setMealCount(dayOfWeek, DEFAULT_MEAL_COUNT);
      setInitializedDays((prev) => new Set(prev).add(dayOfWeek));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to initialize meals');
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const setMealCount = async (dayOfWeek: WeekdayIndex, mealCount: number) => {
    const userId = api.getUserId();
    const useLocalStore = !adminMode && !!userId;
    const current = mealsByDay[dayOfWeek];

    if (useLocalStore) {
      const createdMeals =
        mealCount > current.length
          ? Array.from({ length: mealCount - current.length }, (_, offset) => ({
              id: crypto.randomUUID(),
              mealIndex: current.length + offset,
              name: defaultMealName(current.length + offset),
            }))
          : [];

      await localStore.localSetWeeklyMealCount(userId, dayOfWeek, mealCount, createdMeals);
    } else {
      await api.setWeeklyMealCount({ dayOfWeek, mealCount }, { forUserId });
    }

    await queryClient.invalidateQueries({ queryKey: mealsQueryKey });
    await queryClient.invalidateQueries({ queryKey: entriesQueryKey });
    await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective'] });
  };

  const updateMeal = async (
    meal: WeeklyMeal,
    updates: { name?: string; mealTime?: string | null },
  ) => {
    setMessage('');
    try {
      const userId = api.getUserId();
      const useLocalStore = !adminMode && !!userId;
      if (useLocalStore) {
        await localStore.localUpdateWeeklyMeal(userId, meal.id, {
          dayOfWeek: meal.dayOfWeek as WeekdayIndex,
          mealIndex: meal.mealIndex,
          name: updates.name ?? meal.name,
          mealTime: updates.mealTime !== undefined ? updates.mealTime : meal.mealTime,
        });
      } else {
        await api.updateWeeklyMeal(meal.id, updates, { forUserId });
      }
      await queryClient.invalidateQueries({ queryKey: mealsQueryKey });
      await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update meal');
      setMessageIsError(true);
    }
  };

  const addEntry = async () => {
    if (!foodId || !activeMealId) {
      setMessage('Select a meal and food');
      setMessageIsError(true);
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage('Enter a valid quantity in grams');
      setMessageIsError(true);
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const userId = api.getUserId();
      const useLocalStore = !adminMode && !!userId;
      const input = {
        weeklyMealId: activeMealId,
        foodId,
        quantity: qty,
        unit: 'g',
      };

      if (useLocalStore) {
        await localStore.localCreateWeeklyMealPlanEntry(userId, input);
      } else {
        await api.createWeeklyMealPlan(input, { forUserId });
      }

      await queryClient.invalidateQueries({ queryKey: entriesQueryKey });
      await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective'] });
      setMessage('Added to weekly template');
      setMessageIsError(false);
      setQuantity('100');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to add');
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (id: string) => {
    setMessage('');
    try {
      const userId = api.getUserId();
      const useLocalStore = !adminMode && !!userId;
      if (useLocalStore) {
        await localStore.localRemoveWeeklyMealPlanEntry(userId, id);
      } else {
        await api.deleteWeeklyMealPlan(id, { forUserId });
      }
      await queryClient.invalidateQueries({ queryKey: entriesQueryKey });
      await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to remove');
      setMessageIsError(true);
    }
  };

  const updateEntryQuantity = async (entry: WeeklyMealPlanEntry) => {
    const raw = entryQuantities[entry.id];
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage('Enter a valid quantity in grams');
      setMessageIsError(true);
      return;
    }
    if (qty === entry.quantity) return;

    setMessage('');
    try {
      const userId = api.getUserId();
      const useLocalStore = !adminMode && !!userId;
      if (useLocalStore) {
        await localStore.localUpdateWeeklyMealPlanEntry(userId, entry.id, { quantity: qty });
      } else {
        await api.updateWeeklyMealPlan(entry.id, { quantity: qty }, { forUserId });
      }
      await queryClient.invalidateQueries({ queryKey: entriesQueryKey });
      await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update quantity');
      setMessageIsError(true);
    }
  };

  if (mealsQuery.isLoading || entriesQuery.isLoading || foodsQuery.isLoading) {
    return (
      <div>
        <PageHeader title={title} backTo={backTo} />
        <div className="flex justify-center py-16 text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-30 bg-background shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
        <PageHeader embedded title={title} backTo={backTo} />
        <div className="mx-auto w-full min-w-0 max-w-lg border-b border-border px-4 py-2">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {WEEKDAYS.map((dayName, index) => (
              <Button
                key={dayName}
                type="button"
                size="sm"
                variant={activeDay === index ? 'default' : 'secondary'}
                className="shrink-0"
                onClick={() => setActiveDay(index as WeekdayIndex)}
              >
                {dayName.slice(0, 3)}
              </Button>
            ))}
          </div>

          {hasWeeklyMacroTarget(dayTarget) ? (
            <MacroProgress
              compact
              label={`${WEEKDAYS[activeDay]} plan vs targets`}
              consumed={planned}
              target={{
                calories: dayTarget!.calories,
                protein: dayTarget!.proteinG,
                fat: dayTarget!.fatG,
                carbs: dayTarget!.carbsG,
              }}
            />
          ) : (
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-muted-foreground">Planned totals</p>
              <p className="tabular-nums text-muted-foreground">{formatNutrientsSummary(planned)}</p>
              <p className="text-muted-foreground">
                No targets for {WEEKDAYS[activeDay]}.{' '}
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link to={targetsLink}>Set defaults</Link>
                </Button>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full min-w-0 max-w-lg px-4 pb-8">
        <p className="my-4 text-sm text-muted-foreground">
          Set default meals and foods for each day of the week. Choose how many meals you eat (1–10)
          and optionally set a time for each.
        </p>

        {message && (
          <p className={cn('mb-4 text-sm', messageIsError ? 'text-destructive' : 'text-primary')}>
            {message}
          </p>
        )}

        <Card className="mb-4">
          <CardContent className="flex items-center justify-between gap-3 pt-4">
            <div>
              <h2 className="text-lg font-bold">{WEEKDAYS[activeDay]}</h2>
              <p className="text-sm text-muted-foreground">{activeMeals.length} meals</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={activeMeals.length <= MIN_MEALS_PER_DAY || saving}
                onClick={() => void setMealCount(activeDay, activeMeals.length - 1)}
                aria-label="Fewer meals"
              >
                −
              </Button>
              <span className="min-w-[1.5rem] text-center font-semibold">{activeMeals.length}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={activeMeals.length >= MAX_MEALS_PER_DAY || saving}
                onClick={() => void setMealCount(activeDay, activeMeals.length + 1)}
                aria-label="More meals"
              >
                +
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {activeMeals.map((meal) => {
            const mealEntries = entriesByMealId.get(meal.id) ?? [];
            return (
              <Card key={meal.id}>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Label className="mb-1 text-xs text-muted-foreground">Meal name</Label>
                      <Input
                        value={mealNames[meal.id] ?? meal.name}
                        onChange={(e) =>
                          setMealNames((prev) => ({ ...prev, [meal.id]: e.target.value }))
                        }
                        onBlur={() => {
                          const name = mealNames[meal.id];
                          if (name !== undefined && name !== meal.name) {
                            void updateMeal(meal, { name });
                          }
                        }}
                      />
                    </div>
                    <div className="w-28">
                      <Label className="mb-1 text-xs text-muted-foreground">Time</Label>
                      <Input
                        type="time"
                        value={normalizeMealTime(meal.mealTime) ?? ''}
                        onChange={(e) =>
                          void updateMeal(meal, { mealTime: e.target.value || null })
                        }
                      />
                    </div>
                  </div>

                  {mealEntries.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">No foods in this meal yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {mealEntries.map((entry) => {
                        const food = foodsMap.get(entry.foodId);
                        return (
                          <li
                            key={entry.id}
                            className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{food?.name ?? 'Unknown food'}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Input
                                className="mb-0 w-20 text-right"
                                inputMode="decimal"
                                aria-label={`Quantity for ${food?.name ?? 'food'}`}
                                value={entryQuantities[entry.id] ?? String(entry.quantity)}
                                onChange={(e) =>
                                  setEntryQuantities((prev) => ({
                                    ...prev,
                                    [entry.id]: e.target.value,
                                  }))
                                }
                                onBlur={() => void updateEntryQuantity(entry)}
                              />
                              <span className="text-sm text-muted-foreground">{entry.unit}</span>
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-destructive"
                                onClick={() => void removeEntry(entry.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => setActiveMealId(meal.id)}
                  >
                    Add food to this meal
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {activeMeals.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">
                Add food to{' '}
                {activeMeals.find((meal) => meal.id === activeMealId)?.name ?? 'selected meal'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <select
                className={selectClass}
                value={activeMealId}
                onChange={(e) => setActiveMealId(e.target.value)}
              >
                {activeMeals.map((meal) => (
                  <option key={meal.id} value={meal.id}>
                    {meal.name}
                    {formatMealTime(meal.mealTime) ? ` (${formatMealTime(meal.mealTime)})` : ''}
                  </option>
                ))}
              </select>
              <select className={selectClass} value={foodId} onChange={(e) => setFoodId(e.target.value)}>
                <option value="">Select food…</option>
                {(foodsQuery.data ?? []).map((food) => (
                  <option key={food.id} value={food.id}>
                    {food.brand ? `${food.brand} - ` : ''}
                    {food.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Quantity (g)"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <Button type="button" className="w-full" onClick={() => void addEntry()} disabled={saving}>
                {saving ? 'Adding…' : 'Add to template'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
