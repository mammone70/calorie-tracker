import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MacroProgress } from '../components/MacroProgress';
import { MacroCaloriesFeedback, MacroCaloriesInput } from '../components/MacroCaloriesFeedback';
import { confirmedFoodLogs } from '@calorie-tracker/shared';
import { DailyFoodLog, ensureWeeklyMealsForDate } from '../components/DailyFoodLog';
import { PageHeader } from '../components/PageHeader';
import { useMacroCaloriesValidation } from '../hooks/useMacroCaloriesValidation';
import { api, localStore } from '../lib/client';
import { computeNutrients, sumNutrients } from '@calorie-tracker/client';
import type {
  EffectiveMacroTarget,
  EffectiveMealPlan,
  Food,
  FoodLogEntry,
  Nutrients,
} from '@calorie-tracker/shared';
import { WEEKDAYS, dayOfWeekFromDate, formatMealTime, macroCaloriesError } from '@calorie-tracker/shared';

type Tab = 'targets' | 'plan' | 'log';

function TotalsSummary({ label, nutrients }: { label: string; nutrients: Nutrients }) {
  return (
    <div className="card mb-3">
      <p className="mb-1 font-semibold">{label}</p>
      <p className="text-foreground-secondary">
        {nutrients.calories} cal · P {nutrients.protein}g · F {nutrients.fat}g · C{' '}
        {nutrients.carbs}g
      </p>
    </div>
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
    setCalories(String(effective.calories));
    setProtein(String(effective.proteinG));
    setFat(String(effective.fatG));
    setCarbs(String(effective.carbsG));
  }, [effective?.targetDate, effective?.source, effective?.calories]);

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
      setMessage('This day now has a custom meal plan you can edit');
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to customize');
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
          setCalories(String(weekly.calories));
          setProtein(String(weekly.proteinG));
          setFat(String(weekly.fatG));
          setCarbs(String(weekly.carbsG));
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
      <div className="mx-auto max-w-lg px-4 pb-8">
        <p className="py-4 text-xl font-bold">{date}</p>
        <p className="mb-4 text-muted">{sourceLabel}</p>

        <div className="mb-4 flex gap-2">
          {(['targets', 'plan', 'log'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg border px-2 py-2.5 text-sm font-semibold capitalize ${
                tab === t
                  ? 'border-primary-dark bg-primary-dark text-white'
                  : 'border-border-light bg-surface text-muted'
              }`}
            >
              {t === 'targets' ? 'Targets' : t === 'plan' ? 'Meal Plan' : 'Log'}
            </button>
          ))}
        </div>

        {message && (
          <p className={`mb-4 text-sm ${messageIsError ? 'text-danger' : 'text-primary'}`}>
            {message}
          </p>
        )}

        {tab === 'targets' && (
          <div>
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
            <p className="mb-3 text-sm text-muted">
              Saving here creates a one-off override. Leave unchanged to keep using the weekly
              default. Calories should equal protein×4 + carbs×4 + fat×9.
            </p>
            <MacroCaloriesInput
              value={calories}
              onChange={setCalories}
              placeholder="Calories"
              invalid={macroFieldsInvalid}
              className="mb-2"
            />
            <MacroCaloriesInput
              value={protein}
              onChange={setProtein}
              placeholder="Protein (g)"
              invalid={macroFieldsInvalid}
              className="mb-2"
            />
            <MacroCaloriesInput
              value={fat}
              onChange={setFat}
              placeholder="Fat (g)"
              invalid={macroFieldsInvalid}
              className="mb-2"
            />
            <MacroCaloriesInput
              value={carbs}
              onChange={setCarbs}
              placeholder="Carbs (g)"
              invalid={macroFieldsInvalid}
              className="mb-2"
            />
            <MacroCaloriesFeedback validation={macroValidation} className="mb-3" />
            <button
              type="button"
              className="btn-primary mt-2 w-full"
              onClick={saveOverride}
              disabled={macroFieldsInvalid}
            >
              Save custom target
            </button>
            {effective?.source === 'override' && (
              <button
                type="button"
                className="btn-secondary mt-2 w-full"
                onClick={resetToWeeklyDefault}
              >
                Use weekly default instead
              </button>
            )}
          </div>
        )}

        {tab === 'plan' && (
          <div>
            <p className="mb-3 text-sm text-muted">{planSourceLabel}</p>
            <TotalsSummary label="Planned totals" nutrients={planned} />
            {planMeals.map((meal) => (
              <div key={meal.id} className="card mb-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{meal.name}</h3>
                  {formatMealTime(meal.mealTime) && (
                    <span className="text-sm text-muted">{formatMealTime(meal.mealTime)}</span>
                  )}
                </div>
                {meal.entries.length === 0 ? (
                  <p className="text-sm italic text-muted">No foods planned</p>
                ) : (
                  meal.entries.map((entry) => {
                    const food = foodsMap.get(entry.foodId);
                    return (
                      <div key={entry.id} className="border-t border-border-light py-2 first:border-0">
                        <p className="font-medium">{food?.name ?? 'Unknown'}</p>
                        <p className="text-sm text-muted">
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
              </div>
            ))}
            {planMeals.length === 0 && (
              <p className="italic text-muted">
                No meal plan for this day. Set up weekly templates in Settings.
              </p>
            )}
            {planSource === 'weekly' && planMeals.length > 0 && (
              <button type="button" className="btn-primary mt-3 w-full" onClick={customizeDayPlan}>
                Customize this day&apos;s plan
              </button>
            )}
            {planSource === 'override' && (
              <button
                type="button"
                className="btn-secondary mt-3 w-full"
                onClick={resetPlanToWeekly}
              >
                Use weekly template instead
              </button>
            )}
            <Link to="/weekly-meal-plans" className="link mt-3 block text-center text-sm">
              Edit weekly templates
            </Link>
          </div>
        )}

        {tab === 'log' && (
          <div>
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
          </div>
        )}
      </div>
    </div>
  );
}
