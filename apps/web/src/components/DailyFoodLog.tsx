import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  DEFAULT_MEAL_COUNT,
  dayOfWeekFromDate,
  defaultMealName,
  formatMealTime,
  getClientTimeZone,
  groupFoodLogsByMeal,
  loggedAtForDate,
  mealRefFromEffectiveMeal,
  type EffectiveMealBlock,
  type Food,
  type FoodLogEntry,
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
import { cn, inputFieldClass } from '@/lib/utils';
import { nutrientsForQuantity, sumNutrients } from '@calorie-tracker/client';
import { NutrientsSummary, FoodAmountNutrients } from './NutrientsSummary';
import { FoodPicker } from './FoodPicker';
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
  const [addFoodMealId, setAddFoodMealId] = useState('');
  const [foodId, setFoodId] = useState(preselectedFoodId ?? '');
  const [quantity, setQuantity] = useState('100');
  const [dialogError, setDialogError] = useState('');
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

  const confirmMeal = async (mealLogs: FoodLogEntry[]) => {
    const pending = mealLogs.filter((log) => log.status === 'pending');
    if (pending.length === 0) return;

    setSaving(true);
    setMessage('');
    try {
      const userId = api.getUserId();
      for (const log of pending) {
        const raw = draftQuantities[log.id];
        const qty = Number(raw);
        if (Number.isFinite(qty) && qty > 0 && qty !== log.quantity) {
          if (userId) {
            await localStore.localUpdateFoodLog(userId, log.id, { quantity: qty });
          } else {
            await api.updateFoodLog(log.id, { quantity: qty });
          }
        }

        if (userId) {
          await localStore.localConfirmFoodLog(userId, log.id);
        } else {
          await api.confirmFoodLog(log.id);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['food-logs', date] });
      setMessage('Meal confirmed');
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong');
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
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

  const selectMealForAdd = (meal: EffectiveMealBlock) => {
    setActiveMealId(meal.id);
    setAddFoodMealId(meal.id);
    setFoodId(preselectedFoodId ?? '');
    setQuantity('100');
    setDialogError('');
  };

  const closeAddFoodDialog = () => {
    setAddFoodMealId('');
    setDialogError('');
  };

  const addFoodMeal = meals.find((meal) => meal.id === addFoodMealId);

  const addFood = async () => {
    const meal = meals.find((item) => item.id === activeMealId);
    if (!meal || !foodId) {
      setDialogError('Select a food');
      return;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setDialogError('Enter a valid quantity in grams');
      return;
    }

    setSaving(true);
    setDialogError('');
    try {
      const userId = api.getUserId();
      const input = {
        loggedAt: loggedAtForDate(date, meal.mealTime, getClientTimeZone()),
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
      setFoodId('');
      closeAddFoodDialog();
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : 'Failed to log food');
    } finally {
      setSaving(false);
    }
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
          const mealNutrients = sumNutrients(
            meal.logs.map((log) => {
              const food = foodsMap.get(log.foodId);
              return nutrientsForQuantity(food, draftQuantities[log.id], log.quantity);
            }),
          );

          return (
          <Card key={meal.id}>
            <CardHeader className="space-y-2 pb-2">
              <div className="flex flex-row items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base">{meal.name}</CardTitle>
                  {meal.logs.length > 0 && (
                    <NutrientsSummary nutrients={mealNutrients} className="mt-1" />
                  )}
                </div>
                {formatMealTime(meal.mealTime) && (
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {formatMealTime(meal.mealTime)}
                  </span>
                )}
              </div>
              {mealPendingCount > 0 && (
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => void confirmMeal(meal.logs)}
                  disabled={saving}
                >
                  Confirm meal ({mealPendingCount})
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {meal.logs.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">Nothing planned for this meal</p>
              ) : (
                <ul className="space-y-2">
                  {meal.logs.map((log) => {
                    const food = foodsMap.get(log.foodId);
                    const isPending = log.status === 'pending';
                    const itemNutrients = nutrientsForQuantity(
                      food,
                      draftQuantities[log.id],
                      log.quantity,
                    );
                    return (
                      <li
                        key={log.id}
                        className={cn(
                          'rounded-lg px-3 py-2',
                          isPending ? 'border border-primary/30 bg-primary/5' : 'bg-muted/50',
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
                                value={draftQuantities[log.id] ?? String(log.quantity)}
                                onChange={(e) =>
                                  setDraftQuantities((prev) => ({
                                    ...prev,
                                    [log.id]: e.target.value,
                                  }))
                                }
                                onBlur={() => void updateQuantity(log)}
                              />
                              <span className="text-sm text-muted-foreground">{log.unit}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col gap-1">
                            {isPending && (
                              <Button
                                variant="link"
                                className="h-auto p-0"
                                onClick={() => void confirmLog(log.id)}
                              >
                                Confirm
                              </Button>
                            )}
                            <Button
                              variant="link"
                              className="h-auto p-0 text-destructive"
                              onClick={() => void removeLog(log.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {showAddFood && (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => selectMealForAdd(meal)}
                >
                  Add food to this meal
                </Button>
              )}
            </CardContent>
          </Card>
          );
        })}
      </div>

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
              <DialogDescription>Logging for {date}</DialogDescription>
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
                  onChange={setFoodId}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="log-food-quantity" className="text-sm font-medium">
                  Quantity (g)
                </Label>
                <Input
                  id="log-food-quantity"
                  placeholder="e.g. 100"
                  inputMode="decimal"
                  className={inputFieldClass}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <FoodAmountNutrients
                food={(foodsQuery.data ?? []).find((food) => food.id === foodId)}
                quantity={quantity}
                className="text-sm"
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
