import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DayViewHeader } from '../components/DayViewHeader';
import { TodayProgress } from '../components/TodayProgress';
import { DailyWorkouts } from '../components/DailyWorkouts';
import { confirmedFoodLogs, formatNutrientsSummary } from '@calorie-tracker/shared';
import { DailyFoodLog, ensureWeeklyMealsForDate } from '../components/DailyFoodLog';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/client';
import { todayDateString, computeNutrients, quantityToGrams, sumNutrients } from '@calorie-tracker/client';
import { isValidDateParam } from '../lib/week';
import type { EffectiveMacroTarget, EffectiveMealPlan, Food, FoodLogEntry, Nutrients } from '@calorie-tracker/shared';

export function TodayPage() {
  const today = todayDateString();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const selectedDate = isValidDateParam(dateParam) ? dateParam : today;

  const { sync } = useAuth();
  const queryClient = useQueryClient();

  const onSelectDate = useCallback(
    (date: string) => {
      if (date === today) {
        setSearchParams({}, { replace: true });
      } else {
        setSearchParams({ date }, { replace: true });
      }
    },
    [setSearchParams, today],
  );

  const targetsQuery = useQuery({
    queryKey: ['macro-targets-effective', selectedDate],
    queryFn: () =>
      api.getEffectiveMacroTargets(selectedDate, selectedDate) as Promise<EffectiveMacroTarget[]>,
  });

  const mealsQuery = useQuery({
    queryKey: ['meal-plans-effective', selectedDate],
    queryFn: () => api.getEffectiveMealPlans(selectedDate) as Promise<EffectiveMealPlan>,
  });

  const logsQuery = useQuery({
    queryKey: ['food-logs', selectedDate],
    queryFn: () => api.getFoodLogs(selectedDate) as Promise<FoodLogEntry[]>,
  });

  const foodsQuery = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.getFoods() as Promise<Food[]>,
  });

  const target = targetsQuery.data?.[0];
  const hasTarget = target && target.source !== 'none';
  const foodsMap = new Map((foodsQuery.data ?? []).map((f) => [f.id, f]));
  const meals = mealsQuery.data?.meals ?? [];
  const confirmedLogs = confirmedFoodLogs(logsQuery.data ?? []);

  const consumed: Nutrients = sumNutrients(
    confirmedLogs.map((log) => {
      const food = foodsMap.get(log.foodId);
      if (!food) return { calories: 0, protein: 0, fat: 0, carbs: 0 };
      return computeNutrients(
        food.nutrientsPer100g,
        quantityToGrams(food, log.quantity, log.unit),
      );
    }),
  );

  const onRefresh = async () => {
    await sync();
    await Promise.all([
      targetsQuery.refetch(),
      mealsQuery.refetch(),
      logsQuery.refetch(),
      foodsQuery.refetch(),
    ]);
  };

  const setupMeals = async () => {
    await ensureWeeklyMealsForDate(selectedDate);
    await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective', selectedDate] });
    await queryClient.invalidateQueries({ queryKey: ['weekly-meals'] });
  };

  const mealsHeading = 'Meals';

  return (
    <div>
      <DayViewHeader selectedDate={selectedDate} today={today} onSelectDate={onSelectDate} />

      <div className="mx-auto w-full min-w-0 max-w-lg px-4 pb-4 pt-3">
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-end">
            <Button variant="link" className="h-auto p-0 text-sm" onClick={() => void onRefresh()}>
              Refresh
            </Button>
          </div>

          {targetsQuery.isLoading || logsQuery.isLoading || foodsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading progress…</p>
          ) : hasTarget ? (
            <TodayProgress
              consumed={consumed}
              target={{
                calories: target!.calories,
                protein: target!.proteinG,
                fat: target!.fatG,
                carbs: target!.carbsG,
              }}
            />
          ) : (
            <Card>
              <CardContent className="space-y-1 p-3 text-xs">
                <p className="tabular-nums text-muted-foreground">
                  {formatNutrientsSummary(consumed)}
                </p>
                <p className="text-muted-foreground">
                  No macro target set.{' '}
                  <Button variant="link" className="h-auto p-0 text-xs" asChild>
                    <Link to="/weekly-targets">Set defaults</Link>
                  </Button>
                  {' · '}
                  <Button variant="link" className="h-auto p-0 text-xs" asChild>
                    <Link to={`/day/${selectedDate}`}>Set for this day</Link>
                  </Button>
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <section>
          <h2 className="group relative mb-3 w-fit cursor-help text-lg font-bold">
            {mealsHeading}
            <span
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-64 rounded-md border border-border bg-popover px-3 py-2 text-xs font-normal leading-snug text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              Pre-filled from your meal plan. Confirm each food when you eat it — edit amounts or
              remove anything that changed.
            </span>
          </h2>
          <DailyFoodLog
            date={selectedDate}
            foodsMap={foodsMap}
            logs={logsQuery.data ?? []}
            meals={meals}
            autoMaterialize
            onMealsNeeded={setupMeals}
          />
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold">Workouts</h2>
          <DailyWorkouts date={selectedDate} />
        </section>

        <Button variant="outline" className="mt-4 w-full" size="lg" asChild>
          <Link to={`/day/${selectedDate}`}>View full day details</Link>
        </Button>
      </div>
    </div>
  );
}
