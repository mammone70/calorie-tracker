import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  DEFAULT_MEAL_COUNT,
  dayOfWeekFromDate,
  defaultMealName,
  formatMealTime,
  groupFoodLogsByMeal,
  loggedAtForDate,
  mealRefFromEffectiveMeal,
  type EffectiveMealBlock,
  type Food,
  type FoodLogEntry,
  type WeekdayIndex,
} from '@calorie-tracker/shared';
import { api, localStore } from '../lib/client';

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
  const [foodId, setFoodId] = useState(preselectedFoodId ?? '');
  const [quantity, setQuantity] = useState('100');
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);

  const foodsQuery = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.getFoods() as Promise<Food[]>,
  });

  const grouped = groupFoodLogsByMeal(meals, logs);
  const pendingCount = logs.filter((log) => !log.deletedAt && log.status === 'pending').length;

  useEffect(() => {
    if (preselectedFoodId) {
      setFoodId(preselectedFoodId);
    }
  }, [preselectedFoodId]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const log of logs) {
      next[log.id] = String(log.quantity);
    }
    setDraftQuantities(next);
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

  const runMutation = async (fn: () => Promise<unknown>) => {
    setMessage('');
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ['food-logs', date] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong');
      setMessageIsError(true);
      throw error;
    }
  };

  const updateQuantity = async (log: FoodLogEntry) => {
    const raw = draftQuantities[log.id];
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage('Enter a valid quantity in grams');
      setMessageIsError(true);
      return;
    }
    if (qty === log.quantity) return;

    const userId = api.getUserId();
    await runMutation(async () => {
      if (userId) {
        await localStore.localUpdateFoodLog(userId, log.id, { quantity: qty });
      } else {
        await api.updateFoodLog(log.id, { quantity: qty });
      }
    });
  };

  const confirmLog = async (id: string) => {
    const userId = api.getUserId();
    await runMutation(async () => {
      if (userId) {
        await localStore.localConfirmFoodLog(userId, id);
      } else {
        await api.confirmFoodLog(id);
      }
    });
  };

  const confirmAll = async () => {
    const pending = logs.filter((log) => !log.deletedAt && log.status === 'pending');
    setSaving(true);
    try {
      for (const log of pending) {
        await confirmLog(log.id);
      }
      setMessage('All foods confirmed');
      setMessageIsError(false);
    } catch {
      // message set in runMutation
    } finally {
      setSaving(false);
    }
  };

  const removeLog = async (id: string) => {
    const userId = api.getUserId();
    await runMutation(async () => {
      if (userId) {
        await localStore.localRemoveFoodLog(userId, id);
      } else {
        await api.deleteFoodLog(id);
      }
    });
  };

  const addFood = async () => {
    const meal = meals.find((item) => item.id === activeMealId);
    if (!meal || !foodId) {
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
        loggedAt: loggedAtForDate(date, meal.mealTime),
        ...mealRefFromEffectiveMeal(meal),
        foodId,
        quantity: qty,
        unit: 'g',
        status: 'confirmed' as const,
      };

      if (userId) {
        await localStore.localCreateFoodLog(userId, input);
      } else {
        await api.createFoodLog(input);
      }

      await queryClient.invalidateQueries({ queryKey: ['food-logs', date] });
      setMessage('Food logged');
      setMessageIsError(false);
      setQuantity('100');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to log food');
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  };

  if (meals.length === 0) {
    return (
      <div className="card">
        <p className="mb-3 text-sm text-muted">
          Set up your meal schedule before logging food. Each day uses your weekly template unless
          customized.
        </p>
        <button
          type="button"
          className="btn-primary mb-2 w-full"
          onClick={() => void onMealsNeeded?.()}
        >
          Set up {DEFAULT_MEAL_COUNT} default meals
        </button>
        <Link to="/weekly-meal-plans" className="link block text-center text-sm">
          Edit weekly meal schedule
        </Link>
      </div>
    );
  }

  return (
    <div>
      {message && (
        <p className={`mb-3 text-sm ${messageIsError ? 'text-danger' : 'text-primary'}`}>
          {message}
        </p>
      )}

      {pendingCount > 0 && (
        <button
          type="button"
          className="btn-primary mb-4 w-full"
          onClick={() => void confirmAll()}
          disabled={saving}
        >
          Confirm all ({pendingCount})
        </button>
      )}

      <div className="space-y-4">
        {grouped.map((meal) => (
          <section key={meal.id} className="card">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">{meal.name}</h3>
              {formatMealTime(meal.mealTime) && (
                <span className="text-sm text-muted">{formatMealTime(meal.mealTime)}</span>
              )}
            </div>
            {meal.logs.length === 0 ? (
              <p className="text-sm italic text-muted">Nothing planned for this meal</p>
            ) : (
              <ul className="space-y-2">
                {meal.logs.map((log) => {
                  const food = foodsMap.get(log.foodId);
                  const isPending = log.status === 'pending';
                  return (
                    <li
                      key={log.id}
                      className={`rounded-lg px-3 py-2 ${
                        isPending ? 'border border-primary/30 bg-primary/5' : 'bg-surface'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{food?.name ?? 'Unknown food'}</p>
                          {isPending && (
                            <p className="text-xs text-primary">From meal plan — confirm when eaten</p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              className="input-field mb-0 w-24 py-1 text-sm"
                              inputMode="decimal"
                              value={draftQuantities[log.id] ?? String(log.quantity)}
                              onChange={(e) =>
                                setDraftQuantities((prev) => ({
                                  ...prev,
                                  [log.id]: e.target.value,
                                }))
                              }
                              onBlur={() => void updateQuantity(log)}
                            />
                            <span className="text-sm text-muted">{log.unit}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => void confirmLog(log.id)}
                              className="text-sm font-semibold text-primary"
                            >
                              Confirm
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void removeLog(log.id)}
                            className="text-sm text-danger"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      {showAddFood && (
        <div className="card mt-4 border border-border-light">
          <h3 className="mb-3 font-semibold">Add food</h3>
          <select
            className="input-field mb-2"
            value={activeMealId}
            onChange={(e) => setActiveMealId(e.target.value)}
          >
            {meals.map((meal) => (
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
            className="btn-secondary w-full"
            onClick={() => void addFood()}
            disabled={saving}
          >
            {saving ? 'Adding…' : 'Log extra food'}
          </button>
          <Link to="/foods/search" className="link mt-2 block text-center text-sm">
            Search or add new foods
          </Link>
        </div>
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
