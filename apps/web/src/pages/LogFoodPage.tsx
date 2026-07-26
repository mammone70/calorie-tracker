import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../components/PageHeader';
import { DailyFoodLog, ensureWeeklyMealsForDate } from '../components/DailyFoodLog';
import { api } from '../lib/client';
import { todayDateString } from '@calorie-tracker/client';
import { formatDisplayDate, type EffectiveMealPlan, type Food, type FoodLogEntry } from '@calorie-tracker/shared';

export function LogFoodPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const date = searchParams.get('date') ?? todayDateString();
  const preselectedFoodId = searchParams.get('foodId') ?? '';

  const mealsQuery = useQuery({
    queryKey: ['meal-plans-effective', date],
    queryFn: () => api.getEffectiveMealPlans(date) as Promise<EffectiveMealPlan>,
  });

  const logsQuery = useQuery({
    queryKey: ['food-logs', date],
    queryFn: () => api.getFoodLogs(date) as Promise<FoodLogEntry[]>,
  });

  const foodsQuery = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.getFoods() as Promise<Food[]>,
  });

  const foodsMap = new Map((foodsQuery.data ?? []).map((food) => [food.id, food]));

  const setupMeals = async () => {
    await ensureWeeklyMealsForDate(date);
    await queryClient.invalidateQueries({ queryKey: ['meal-plans-effective', date] });
    await queryClient.invalidateQueries({ queryKey: ['weekly-meals'] });
  };

  return (
    <div>
      <PageHeader title="Log Food" backTo="/" />
      <div className="mx-auto w-full min-w-0 max-w-lg px-4 pb-8">
        <p className="my-4 text-sm text-muted-foreground">
          Logging for {formatDisplayDate(date)}
        </p>

        {preselectedFoodId && foodsMap.get(preselectedFoodId) && (
          <p className="mb-4 text-sm">
            Selected: <span className="font-semibold">{foodsMap.get(preselectedFoodId)!.name}</span>
          </p>
        )}

        <DailyFoodLog
          date={date}
          foodsMap={foodsMap}
          logs={logsQuery.data ?? []}
          meals={mealsQuery.data?.meals ?? []}
          preselectedFoodId={preselectedFoodId || undefined}
          onMealsNeeded={setupMeals}
        />

        <Button variant="link" className="mt-4 w-full" asChild>
          <Link to={`/day/${date}`}>View full day details</Link>
        </Button>
      </div>
    </div>
  );
}
