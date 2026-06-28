import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { api, localStore } from '../lib/client';
import {
  DEFAULT_MEAL_COUNT,
  MAX_MEALS_PER_DAY,
  MIN_MEALS_PER_DAY,
  WEEKDAYS,
  defaultMealName,
  formatMealTime,
  normalizeMealTime,
  type Food,
  type WeekdayIndex,
  type WeeklyMeal,
  type WeeklyMealPlanEntry,
} from '@calorie-tracker/shared';

export function WeeklyMealPlansPage() {
  const queryClient = useQueryClient();
  const [activeDay, setActiveDay] = useState<WeekdayIndex>(0);
  const [foodId, setFoodId] = useState('');
  const [activeMealId, setActiveMealId] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mealNames, setMealNames] = useState<Record<string, string>>({});
  const [initializedDays, setInitializedDays] = useState<Set<number>>(new Set());

  const mealsQuery = useQuery({
    queryKey: ['weekly-meals'],
    queryFn: () => api.getWeeklyMeals() as Promise<WeeklyMeal[]>,
  });

  const entriesQuery = useQuery({
    queryKey: ['weekly-meal-plans'],
    queryFn: () => api.getWeeklyMealPlans() as Promise<WeeklyMealPlanEntry[]>,
  });

  const foodsQuery = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.getFoods() as Promise<Food[]>,
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

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const meal of mealsQuery.data ?? []) {
      next[meal.id] = meal.name;
    }
    setMealNames(next);
  }, [mealsQuery.data]);

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
    const current = mealsByDay[dayOfWeek];

    if (userId) {
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
      await api.setWeeklyMealCount({ dayOfWeek, mealCount });
    }

    await queryClient.invalidateQueries({ queryKey: ['weekly-meals'] });
    await queryClient.invalidateQueries({ queryKey: ['weekly-meal-plans'] });
    await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective'] });
  };

  const updateMeal = async (
    meal: WeeklyMeal,
    updates: { name?: string; mealTime?: string | null },
  ) => {
    setMessage('');
    try {
      const userId = api.getUserId();
      if (userId) {
        await localStore.localUpdateWeeklyMeal(userId, meal.id, {
          dayOfWeek: meal.dayOfWeek as WeekdayIndex,
          mealIndex: meal.mealIndex,
          name: updates.name ?? meal.name,
          mealTime: updates.mealTime !== undefined ? updates.mealTime : meal.mealTime,
        });
      } else {
        await api.updateWeeklyMeal(meal.id, updates);
      }
      await queryClient.invalidateQueries({ queryKey: ['weekly-meals'] });
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
      const input = {
        weeklyMealId: activeMealId,
        foodId,
        quantity: qty,
        unit: 'g',
      };

      if (userId) {
        await localStore.localCreateWeeklyMealPlanEntry(userId, input);
      } else {
        await api.createWeeklyMealPlan(input);
      }

      await queryClient.invalidateQueries({ queryKey: ['weekly-meal-plans'] });
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
      if (userId) {
        await localStore.localRemoveWeeklyMealPlanEntry(userId, id);
      } else {
        await api.deleteWeeklyMealPlan(id);
      }
      await queryClient.invalidateQueries({ queryKey: ['weekly-meal-plans'] });
      await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to remove');
      setMessageIsError(true);
    }
  };

  if (mealsQuery.isLoading || entriesQuery.isLoading || foodsQuery.isLoading) {
    return (
      <div>
        <PageHeader title="Weekly Meal Plans" backTo="/settings" />
        <div className="flex justify-center py-16 text-muted">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Weekly Meal Plans" backTo="/settings" />
      <div className="mx-auto max-w-lg px-4 pb-8">
        <p className="my-4 text-sm text-muted">
          Set default meals and foods for each day of the week. Choose how many meals you eat (1–10)
          and optionally set a time for each.
        </p>

        {message && (
          <p className={`mb-4 text-sm ${messageIsError ? 'text-danger' : 'text-primary'}`}>
            {message}
          </p>
        )}

        <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
          {WEEKDAYS.map((dayName, index) => (
            <button
              key={dayName}
              type="button"
              onClick={() => setActiveDay(index as WeekdayIndex)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${
                activeDay === index ? 'bg-primary-dark text-white' : 'bg-surface text-muted'
              }`}
            >
              {dayName.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="card mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{WEEKDAYS[activeDay]}</h2>
            <p className="text-sm text-muted">{activeMeals.length} meals</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary px-3 py-1 text-lg leading-none"
              disabled={activeMeals.length <= MIN_MEALS_PER_DAY || saving}
              onClick={() => void setMealCount(activeDay, activeMeals.length - 1)}
              aria-label="Fewer meals"
            >
              −
            </button>
            <span className="min-w-[1.5rem] text-center font-semibold">{activeMeals.length}</span>
            <button
              type="button"
              className="btn-secondary px-3 py-1 text-lg leading-none"
              disabled={activeMeals.length >= MAX_MEALS_PER_DAY || saving}
              onClick={() => void setMealCount(activeDay, activeMeals.length + 1)}
              aria-label="More meals"
            >
              +
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {activeMeals.map((meal) => {
            const mealEntries = entriesByMealId.get(meal.id) ?? [];
            return (
              <section key={meal.id} className="card">
                <div className="mb-3 flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-xs font-medium text-muted">Meal name</label>
                    <input
                      className="input-field"
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
                    <label className="mb-1 block text-xs font-medium text-muted">Time</label>
                    <input
                      type="time"
                      className="input-field"
                      value={normalizeMealTime(meal.mealTime) ?? ''}
                      onChange={(e) =>
                        void updateMeal(meal, { mealTime: e.target.value || null })
                      }
                    />
                  </div>
                </div>

                {mealEntries.length === 0 ? (
                  <p className="mb-3 text-sm italic text-muted">No foods in this meal yet.</p>
                ) : (
                  <ul className="mb-3 space-y-2">
                    {mealEntries.map((entry) => {
                      const food = foodsMap.get(entry.foodId);
                      return (
                        <li
                          key={entry.id}
                          className="flex items-start justify-between gap-3 rounded-lg bg-surface px-3 py-2"
                        >
                          <div>
                            <p className="font-medium">{food?.name ?? 'Unknown food'}</p>
                            <p className="text-sm text-muted">
                              {entry.quantity}
                              {entry.unit}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void removeEntry(entry.id)}
                            className="text-sm text-danger"
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <button
                  type="button"
                  className="text-sm text-primary"
                  onClick={() => setActiveMealId(meal.id)}
                >
                  {activeMealId === meal.id ? 'Adding food here' : 'Add food to this meal'}
                </button>
              </section>
            );
          })}
        </div>

        {activeMeals.length > 0 && (
          <div className="card mt-4 border border-border-light">
            <h3 className="mb-3 font-semibold">
              Add food to{' '}
              {activeMeals.find((meal) => meal.id === activeMealId)?.name ?? 'selected meal'}
            </h3>
            <select
              className="input-field mb-2"
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
            <select
              className="input-field"
              value={foodId}
              onChange={(e) => setFoodId(e.target.value)}
            >
              <option value="">Select food…</option>
              {(foodsQuery.data ?? []).map((food) => (
                <option key={food.id} value={food.id}>
                  {food.brand ? `${food.brand} - ` : ''}
                  {food.name}
                </option>
              ))}
            </select>
            <input
              className="input-field"
              placeholder="Quantity (g)"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => void addEntry()}
              disabled={saving}
            >
              {saving ? 'Adding…' : 'Add to template'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
