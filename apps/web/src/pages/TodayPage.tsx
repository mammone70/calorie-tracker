import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DayViewHeader } from '../components/DayViewHeader';
import { TodayProgress } from '../components/TodayProgress';
import { BodyWeightCard } from '../components/BodyWeightCard';
import { WaistCircumferenceCard } from '../components/WaistCircumferenceCard';
import { DailyWorkouts } from '../components/DailyWorkouts';
import { confirmedFoodLogs, formatNutrientsSummary } from '@calorie-tracker/shared';
import { DailyFoodLog, ensureWeeklyMealsForDate } from '../components/DailyFoodLog';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/client';
import { todayDateString, computeNutrients, quantityToGrams, sumNutrients } from '@calorie-tracker/client';
import { isValidDateParam } from '../lib/week';
import type { EffectiveMacroTarget, EffectiveMealPlan, Food, FoodLogEntry, Nutrients } from '@calorie-tracker/shared';

type TodayTab = 'food' | 'training';

function parseTodayTab(value: string | null): TodayTab {
  return value === 'training' ? 'training' : 'food';
}

export function TodayPage() {
  const today = todayDateString();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const selectedDate = isValidDateParam(dateParam) ? dateParam : today;
  const tab = parseTodayTab(searchParams.get('tab'));

  const { sync } = useAuth();
  const queryClient = useQueryClient();

  const onSelectDate = useCallback(
    (date: string) => {
      const next = new URLSearchParams();
      if (date !== today) next.set('date', date);
      if (tab === 'training') next.set('tab', 'training');
      setSearchParams(next, { replace: true });
    },
    [setSearchParams, tab, today],
  );

  const onTabChange = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value === 'training') next.set('tab', 'training');
      else next.delete('tab');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
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
  const allActiveLogs = (logsQuery.data ?? []).filter((log) => !log.deletedAt);
  const confirmedLogs = confirmedFoodLogs(logsQuery.data ?? []);

  const nutrientsFromLogs = (entries: FoodLogEntry[]): Nutrients =>
    sumNutrients(
      entries.map((log) => {
        const food = foodsMap.get(log.foodId);
        if (!food) return { calories: 0, protein: 0, fat: 0, carbs: 0 };
        return computeNutrients(
          food.nutrientsPer100g,
          quantityToGrams(food, log.quantity, log.unit),
        );
      }),
    );

  const consumed = nutrientsFromLogs(confirmedLogs);
  const input = nutrientsFromLogs(allActiveLogs);

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

  return (
    <div>
      <DayViewHeader selectedDate={selectedDate} today={today} onSelectDate={onSelectDate} />

      <div className="mx-auto w-full min-w-0 max-w-lg space-y-3 px-4 pb-4 pt-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <BodyWeightCard date={selectedDate} />
          <WaistCircumferenceCard date={selectedDate} />
        </div>

        <Tabs value={tab} onValueChange={onTabChange} className="w-full gap-0">
          <TabsList>
            <TabsTrigger
              value="food"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-active:bg-primary data-active:text-primary-foreground"
            >
              Food
            </TabsTrigger>
            <TabsTrigger
              value="training"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-active:bg-primary data-active:text-primary-foreground"
            >
              Training
            </TabsTrigger>
          </TabsList>

          <div className="relative mt-3 min-h-[12rem]">
            <AnimatePresence mode="wait" initial={false}>
              {tab === 'food' ? (
                <motion.div
                  key="food"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-end">
                      <Button
                        variant="link"
                        className="h-auto p-0 text-sm"
                        onClick={() => void onRefresh()}
                      >
                        Refresh
                      </Button>
                    </div>

                    {targetsQuery.isLoading || logsQuery.isLoading || foodsQuery.isLoading ? (
                      <p className="text-xs text-muted-foreground">Loading progress…</p>
                    ) : hasTarget ? (
                      <TodayProgress
                        consumed={consumed}
                        input={input}
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
                            Consumed {formatNutrientsSummary(consumed)}
                          </p>
                          <p className="tabular-nums text-muted-foreground">
                            Input {formatNutrientsSummary(input)}
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
                      Meals
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-64 rounded-md border border-border bg-popover px-3 py-2 text-xs font-normal leading-snug text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        Pre-filled from your meal plan. Confirm each food when you eat it — edit
                        amounts or remove anything that changed.
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

                  <Button variant="outline" className="w-full" size="lg" asChild>
                    <Link to={`/day/${selectedDate}`}>View full day details</Link>
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="training"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <DailyWorkouts date={selectedDate} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
