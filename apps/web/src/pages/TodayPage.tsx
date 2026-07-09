import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MacroProgress } from '../components/MacroProgress';
import { confirmedFoodLogs, formatHeaderDate, formatNutrientsSummary } from '@calorie-tracker/shared';
import { DailyFoodLog, ensureWeeklyMealsForDate } from '../components/DailyFoodLog';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/client';
import { todayDateString, computeNutrients, sumNutrients } from '@calorie-tracker/client';
import type { EffectiveMacroTarget, EffectiveMealPlan, Food, FoodLogEntry, Nutrients } from '@calorie-tracker/shared';

export function TodayPage() {
  const today = todayDateString();
  const { sync } = useAuth();
  const queryClient = useQueryClient();

  const targetsQuery = useQuery({
    queryKey: ['macro-targets-effective', today],
    queryFn: () => api.getEffectiveMacroTargets(today, today) as Promise<EffectiveMacroTarget[]>,
  });

  const mealsQuery = useQuery({
    queryKey: ['meal-plans-effective', today],
    queryFn: () => api.getEffectiveMealPlans(today) as Promise<EffectiveMealPlan>,
  });

  const logsQuery = useQuery({
    queryKey: ['food-logs', today],
    queryFn: () => api.getFoodLogs(today) as Promise<FoodLogEntry[]>,
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
      const grams = log.unit === 'g' ? log.quantity : log.quantity;
      return computeNutrients(food.nutrientsPer100g, grams);
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
    await ensureWeeklyMealsForDate(today);
    await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective', today] });
    await queryClient.invalidateQueries({ queryKey: ['weekly-meals'] });
  };

  const macroLoading = targetsQuery.isLoading || logsQuery.isLoading || foodsQuery.isLoading;
  const formattedToday = formatHeaderDate(today);

  return (
    <div>
      <div className="sticky top-[calc(2.75rem+max(0.5rem,env(safe-area-inset-top,0px)))] z-20 border-b border-border bg-header-surface backdrop-surface shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
        <div className="mx-auto w-full min-w-0 max-w-lg px-4 py-2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{formattedToday}</p>
            <Button variant="link" className="h-auto p-0 text-sm" onClick={() => void onRefresh()}>
              Refresh
            </Button>
          </div>

          {macroLoading ? (
            <p className="text-xs text-muted-foreground">Loading progress…</p>
          ) : hasTarget ? (
            <MacroProgress
              compact
              consumed={consumed}
              target={{
                calories: target!.calories,
                protein: target!.proteinG,
                fat: target!.fatG,
                carbs: target!.carbsG,
              }}
            />
          ) : (
            <div className="space-y-1 text-xs">
              <p className="tabular-nums text-muted-foreground">{formatNutrientsSummary(consumed)}</p>
              <p className="text-muted-foreground">
                No macro target set.{' '}
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link to="/weekly-targets">Set defaults</Link>
                </Button>
                {' · '}
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link to={`/day/${today}`}>Set for today</Link>
                </Button>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full min-w-0 max-w-lg px-4 pb-4">
        <section className="mt-4">
          <h2 className="mb-1 text-lg font-bold">Today&apos;s meals</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Pre-filled from your meal plan. Confirm each food when you eat it — edit amounts or remove
            anything that changed today.
          </p>
          <DailyFoodLog
            date={today}
            foodsMap={foodsMap}
            logs={logsQuery.data ?? []}
            meals={meals}
            autoMaterialize
            onMealsNeeded={setupMeals}
          />
        </section>

        <Button variant="outline" className="mt-4 w-full" size="lg" asChild>
          <Link to={`/day/${today}`}>View full day details</Link>
        </Button>
      </div>
    </div>
  );
}
