import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MacroProgress } from '../components/MacroProgress';
import { MacroCaloriesFeedback, MacroCaloriesInput } from '../components/MacroCaloriesFeedback';
import { confirmedFoodLogs } from '@calorie-tracker/shared';
import { DailyFoodLog, ensureWeeklyMealsForDate } from '../components/DailyFoodLog';
import { PageHeader } from '../components/PageHeader';
import { useMacroCaloriesValidation } from '../hooks/useMacroCaloriesValidation';
import { api, localStore } from '../lib/client';
import { cn, selectClass } from '@/lib/utils';
import { computeNutrients, sumNutrients } from '@calorie-tracker/client';
import type {
  EffectiveMacroTarget,
  EffectiveMealBlock,
  EffectiveMealPlan,
  Food,
  FoodLogEntry,
  MealPlanFoodEntry,
  Nutrients,
} from '@calorie-tracker/shared';
import { WEEKDAYS, dayOfWeekFromDate, formatMealTime, formatNutrientsSummary, macroCaloriesError, roundMacroValue } from '@calorie-tracker/shared';

type Tab = 'targets' | 'plan' | 'log';

function TotalsSummary({ label, nutrients }: { label: string; nutrients: Nutrients }) {
  return (
    <Card className="mb-3 w-full">
      <CardContent>
        <p className="mb-1 font-semibold">{label}</p>
        <p className="text-muted-foreground">{formatNutrientsSummary(nutrients)}</p>
      </CardContent>
    </Card>
  );
}

export function DayDetailPage() {
  const { date } = useParams<{ date: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('targets');
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);

  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [planFoodId, setPlanFoodId] = useState('');
  const [planActiveMealId, setPlanActiveMealId] = useState('');
  const [planQuantity, setPlanQuantity] = useState('100');
  const [planEntryQuantities, setPlanEntryQuantities] = useState<Record<string, string>>({});
  const [planSaving, setPlanSaving] = useState(false);

  const macroValidation = useMacroCaloriesValidation({ calories, protein, fat, carbs });
  const macroFieldsInvalid = macroValidation.show && !macroValidation.isValid;

  const effectiveQuery = useQuery({
    queryKey: ['macro-targets-effective', date],
    queryFn: () => api.getEffectiveMacroTargets(date!, date!) as Promise<EffectiveMacroTarget[]>,
    enabled: !!date,
  });

  const effectivePlanQuery = useQuery({
    queryKey: ['meal-plans-effective', date],
    queryFn: () => api.getEffectiveMealPlans(date!) as Promise<EffectiveMealPlan>,
    enabled: !!date,
  });

  const logsQuery = useQuery({
    queryKey: ['food-logs', date],
    queryFn: () => api.getFoodLogs(date!) as Promise<FoodLogEntry[]>,
    enabled: !!date,
  });

  const foodsQuery = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.getFoods() as Promise<Food[]>,
  });

  const effective = effectiveQuery.data?.[0];
  const planMeals = effectivePlanQuery.data?.meals ?? [];
  const planSource = effectivePlanQuery.data?.source ?? 'none';
  const planEntries = planMeals.flatMap((meal) => meal.entries);
  const foodsMap = new Map((foodsQuery.data ?? []).map((f) => [f.id, f]));

  useEffect(() => {
    if (!effective || effective.source === 'none') return;
    setCalories(String(roundMacroValue(effective.calories)));
    setProtein(String(roundMacroValue(effective.proteinG)));
    setFat(String(roundMacroValue(effective.fatG)));
    setCarbs(String(roundMacroValue(effective.carbsG)));
  }, [effective?.targetDate, effective?.source, effective?.calories]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const meal of planMeals) {
      for (const entry of meal.entries) {
        next[entry.id] = String(entry.quantity);
      }
    }
    setPlanEntryQuantities(next);
  }, [effectivePlanQuery.data]);

  useEffect(() => {
    if (!planActiveMealId && planMeals.length > 0) {
      setPlanActiveMealId(planMeals[0].id);
    }
    if (planActiveMealId && !planMeals.some((meal) => meal.id === planActiveMealId)) {
      setPlanActiveMealId(planMeals[0]?.id ?? '');
    }
  }, [planMeals, planActiveMealId]);

  const computeEntries = (entries: Array<{ foodId: string; quantity: number; unit: string }>) =>
    sumNutrients(
      entries.map((entry) => {
        const food = foodsMap.get(entry.foodId);
        if (!food) return { calories: 0, protein: 0, fat: 0, carbs: 0 };
        const grams = entry.unit === 'g' ? entry.quantity : entry.quantity;
        return computeNutrients(food.nutrientsPer100g, grams);
      }),
    );

  const consumed = computeEntries(confirmedFoodLogs(logsQuery.data ?? []));
  const planned = computeEntries(planEntries);

  const customizeDayPlan = async () => {
    if (!date) return;
    try {
      await api.materializeWeeklyMealPlan(date);
      await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective', date] });
      await queryClient.invalidateQueries({ queryKey: ['meal-plans', date] });
      setTab('plan');
      setMessage('This day now has a custom meal plan you can edit');
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to customize');
      setMessageIsError(true);
    }
  };

  const invalidatePlanQueries = async () => {
    if (!date) return;
    await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective', date] });
    await queryClient.invalidateQueries({ queryKey: ['meal-plans', date] });
  };

  const addPlanEntry = async () => {
    if (!date || !planFoodId || !planActiveMealId) {
      setMessage('Select a meal and food');
      setMessageIsError(true);
      return;
    }
    const qty = Number(planQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage('Enter a valid quantity in grams');
      setMessageIsError(true);
      return;
    }

    setPlanSaving(true);
    setMessage('');
    try {
      const userId = api.getUserId();
      const input = {
        planDate: date,
        dayMealId: planActiveMealId,
        foodId: planFoodId,
        quantity: qty,
        unit: 'g',
      };

      if (userId) {
        await localStore.localCreateMealPlanEntry(userId, input);
      } else {
        await api.createMealPlan(input);
      }

      await invalidatePlanQueries();
      setMessage('Added to this day\'s plan');
      setMessageIsError(false);
      setPlanQuantity('100');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to add');
      setMessageIsError(true);
    } finally {
      setPlanSaving(false);
    }
  };

  const removePlanEntry = async (id: string) => {
    setMessage('');
    try {
      const userId = api.getUserId();
      if (userId) {
        await localStore.localRemoveMealPlanEntry(userId, id);
      } else {
        await api.deleteMealPlan(id);
      }
      await invalidatePlanQueries();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to remove');
      setMessageIsError(true);
    }
  };

  const updatePlanEntryQuantity = async (entry: MealPlanFoodEntry, meal: EffectiveMealBlock) => {
    if (planSource !== 'override' || !date) return;
    const raw = planEntryQuantities[entry.id];
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
      const input = {
        planDate: date,
        dayMealId: meal.id,
        foodId: entry.foodId,
        quantity: qty,
        unit: entry.unit,
      };

      if (userId) {
        await localStore.localUpdateMealPlanEntry(userId, entry.id, input);
      } else {
        await api.updateMealPlan(entry.id, { quantity: qty });
      }
      await invalidatePlanQueries();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update quantity');
      setMessageIsError(true);
    }
  };

  const resetPlanToWeekly = async () => {
    if (!date) return;
    try {
      await api.resetMealPlanToWeekly(date);
      await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective', date] });
      await queryClient.invalidateQueries({ queryKey: ['meal-plans', date] });
      setMessage('This day now uses the weekly meal plan template');
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to reset');
      setMessageIsError(true);
    }
  };

  const saveOverride = async () => {
    if (!date) return;
    const input = {
      targetDate: date,
      calories: Number(calories) || 0,
      proteinG: Number(protein) || 0,
      fatG: Number(fat) || 0,
      carbsG: Number(carbs) || 0,
    };

    const validationError = macroCaloriesError(
      input.calories,
      input.proteinG,
      input.fatG,
      input.carbsG,
    );
    if (validationError) {
      setMessage(validationError);
      setMessageIsError(true);
      return;
    }

    try {
      const userId = api.getUserId();

      if (userId) {
        await localStore.localUpsertMacroTarget(userId, input);
      } else {
        await api.upsertMacroTarget(input);
      }

      await queryClient.invalidateQueries({ queryKey: ['macro-targets-effective'] });
      setMessage('Custom target saved for this day');
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save');
      setMessageIsError(true);
    }
  };

  const resetToWeeklyDefault = async () => {
    if (!effective?.overrideId) return;
    try {
      const userId = api.getUserId();
      if (userId) {
        await localStore.localRemoveMacroTarget(userId, effective.overrideId);
      } else {
        await api.deleteMacroTarget(effective.overrideId);
      }

      await queryClient.invalidateQueries({ queryKey: ['macro-targets-effective'] });

      if (effective.weeklyDayOfWeek !== undefined) {
        const weeklyQuery = (await api.getWeeklyMacroTargets()) as Array<{
          dayOfWeek: number;
          calories: number;
          proteinG: number;
          fatG: number;
          carbsG: number;
        }>;
        const weekly = weeklyQuery.find((row) => row.dayOfWeek === effective.weeklyDayOfWeek);
        if (weekly) {
          setCalories(String(roundMacroValue(weekly.calories)));
          setProtein(String(roundMacroValue(weekly.proteinG)));
          setFat(String(roundMacroValue(weekly.fatG)));
          setCarbs(String(roundMacroValue(weekly.carbsG)));
        } else {
          setCalories('');
          setProtein('');
          setFat('');
          setCarbs('');
        }
      }

      setMessage('This day now uses the weekly default target');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to reset');
    }
  };

  const planSourceLabel =
    planSource === 'override'
      ? 'Custom meal plan for this date'
      : planSource === 'weekly'
        ? `Weekly template (${WEEKDAYS[dayOfWeekFromDate(date!)]})`
        : 'No meal plan set';

  if (!date) return null;

  const sourceLabel =
    effective?.source === 'override'
      ? 'Custom override for this date'
      : effective?.source === 'weekly'
        ? `Weekly default (${WEEKDAYS[effective.weeklyDayOfWeek ?? 0]})`
        : 'No target set';

  return (
    <div>
      <PageHeader title="Day" backTo="/calendar" />
      <div className="mx-auto w-full min-w-0 max-w-lg px-4 pb-8">
        <p className="py-4 text-xl font-bold">{date}</p>
        <p className="mb-4 text-muted-foreground">{sourceLabel}</p>

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="mb-4 w-full">
          <TabsList>
            <TabsTrigger value="targets">Targets</TabsTrigger>
            <TabsTrigger value="plan">Meal Plan</TabsTrigger>
            <TabsTrigger value="log">Log</TabsTrigger>
          </TabsList>

          {message && (
            <p className={cn('my-4 text-sm', messageIsError ? 'text-destructive' : 'text-primary')}>
              {message}
            </p>
          )}

          <TabsContent value="targets" className="mt-4">
            {effective && effective.source !== 'none' && (
              <MacroProgress
                label="Progress vs Target"
                consumed={consumed}
                target={{
                  calories: effective.calories,
                  protein: effective.proteinG,
                  fat: effective.fatG,
                  carbs: effective.carbsG,
                }}
              />
            )}

            <h2 className="mb-2 font-bold">Set target for this day</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Saving here creates a one-off override. Leave unchanged to keep using the weekly
              default. Calories should equal protein×4 + carbs×4 + fat×9.
            </p>
            <div className="space-y-2">
              <MacroCaloriesInput
                id="day-target-calories"
                label="Calories"
                value={calories}
                onChange={setCalories}
                placeholder="e.g. 2200"
                invalid={macroFieldsInvalid}
              />
              <MacroCaloriesInput
                id="day-target-protein"
                label="Protein (g)"
                value={protein}
                onChange={setProtein}
                placeholder="e.g. 180"
                invalid={macroFieldsInvalid}
              />
              <MacroCaloriesInput
                id="day-target-fat"
                label="Fat (g)"
                value={fat}
                onChange={setFat}
                placeholder="e.g. 70"
                invalid={macroFieldsInvalid}
              />
              <MacroCaloriesInput
                id="day-target-carbs"
                label="Carbs (g)"
                value={carbs}
                onChange={setCarbs}
                placeholder="e.g. 200"
                invalid={macroFieldsInvalid}
              />
              <MacroCaloriesFeedback validation={macroValidation} className="mb-1" />
              <Button
                type="button"
                className="mt-2 w-full"
                size="lg"
                onClick={saveOverride}
                disabled={macroFieldsInvalid}
              >
                Save custom target
              </Button>
              {effective?.source === 'override' && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={resetToWeeklyDefault}
                >
                  Use weekly default instead
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="plan" className="mt-4">
            <p className="mb-3 text-sm text-muted-foreground">{planSourceLabel}</p>
            <TotalsSummary label="Planned totals" nutrients={planned} />
            {planMeals.map((meal) => (
              <Card key={meal.id} className="mb-3">
                <CardHeader className="flex-row items-baseline justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">{meal.name}</CardTitle>
                  {formatMealTime(meal.mealTime) && (
                    <span className="text-sm text-muted-foreground">{formatMealTime(meal.mealTime)}</span>
                  )}
                </CardHeader>
                <CardContent>
                  {meal.entries.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">No foods planned</p>
                  ) : planSource === 'override' ? (
                    <ul className="space-y-2">
                      {meal.entries.map((entry) => {
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
                                value={planEntryQuantities[entry.id] ?? String(entry.quantity)}
                                onChange={(e) =>
                                  setPlanEntryQuantities((prev) => ({
                                    ...prev,
                                    [entry.id]: e.target.value,
                                  }))
                                }
                                onBlur={() => void updatePlanEntryQuantity(entry, meal)}
                              />
                              <span className="text-sm text-muted-foreground">{entry.unit}</span>
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-destructive"
                                onClick={() => void removePlanEntry(entry.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    meal.entries.map((entry) => {
                      const food = foodsMap.get(entry.foodId);
                      return (
                        <div key={entry.id} className="border-t border-border py-2 first:border-0 first:pt-0">
                          <p className="font-medium">{food?.name ?? 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.quantity}
                            {entry.unit}
                            {meal.source === 'weekly' && (
                              <span className="ml-2 text-xs text-primary">(template)</span>
                            )}
                          </p>
                        </div>
                      );
                    })
                  )}
                  {planSource === 'override' && (
                    <Button
                      type="button"
                      variant="link"
                      className="mt-2 h-auto p-0"
                      onClick={() => setPlanActiveMealId(meal.id)}
                    >
                      Add food to this meal
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {planMeals.length === 0 && (
              <p className="italic text-muted-foreground">
                No meal plan for this day. Set up weekly templates in Settings.
              </p>
            )}
            {planSource === 'override' && planMeals.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">
                    Add food to{' '}
                    {planMeals.find((meal) => meal.id === planActiveMealId)?.name ?? 'selected meal'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <select
                    className={selectClass}
                    value={planActiveMealId}
                    onChange={(e) => setPlanActiveMealId(e.target.value)}
                  >
                    {planMeals.map((meal) => (
                      <option key={meal.id} value={meal.id}>
                        {meal.name}
                        {formatMealTime(meal.mealTime) ? ` (${formatMealTime(meal.mealTime)})` : ''}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectClass}
                    value={planFoodId}
                    onChange={(e) => setPlanFoodId(e.target.value)}
                  >
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
                    value={planQuantity}
                    onChange={(e) => setPlanQuantity(e.target.value)}
                  />
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => void addPlanEntry()}
                    disabled={planSaving}
                  >
                    {planSaving ? 'Adding…' : 'Add to plan'}
                  </Button>
                </CardContent>
              </Card>
            )}
            {planSource === 'weekly' && planMeals.length > 0 && (
              <Button type="button" className="mt-3 w-full" size="lg" onClick={customizeDayPlan}>
                Customize this day&apos;s plan
              </Button>
            )}
            {planSource === 'override' && (
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                size="lg"
                onClick={resetPlanToWeekly}
              >
                Use weekly template instead
              </Button>
            )}
            <Button variant="link" className="mt-3 w-full" asChild>
              <Link to="/weekly-meal-plans">Edit weekly templates</Link>
            </Button>
          </TabsContent>

          <TabsContent value="log" className="mt-4">
            <TotalsSummary label="Logged totals" nutrients={consumed} />
            <DailyFoodLog
              date={date}
              foodsMap={foodsMap}
              logs={logsQuery.data ?? []}
              meals={effectivePlanQuery.data?.meals ?? []}
              autoMaterialize
              onMealsNeeded={async () => {
                await ensureWeeklyMealsForDate(date);
                await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective', date] });
                await queryClient.invalidateQueries({ queryKey: ['weekly-meals'] });
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
