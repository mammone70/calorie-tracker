import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MacroCaloriesFeedback, MacroCaloriesInput } from '../components/MacroCaloriesFeedback';
import { PageHeader } from '../components/PageHeader';
import {
  getMacroCaloriesValidation,
  macroFormHasValues,
} from '../hooks/useMacroCaloriesValidation';
import { api, localStore } from '../lib/client';
import { cn } from '@/lib/utils';
import { WEEKDAYS, macroCaloriesError, roundMacroValue, type WeeklyMacroTarget, type WeekdayIndex } from '@calorie-tracker/shared';

type DayForm = {
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
};

const emptyDayForm = (): DayForm => ({
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
});

export function WeeklyTargetsPage() {
  const queryClient = useQueryClient();
  const [forms, setForms] = useState<DayForm[]>(() => WEEKDAYS.map(() => emptyDayForm()));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);

  const weeklyQuery = useQuery({
    queryKey: ['weekly-macro-targets'],
    queryFn: () => api.getWeeklyMacroTargets() as Promise<WeeklyMacroTarget[]>,
  });

  useEffect(() => {
    if (!weeklyQuery.data) return;
    setForms(
      WEEKDAYS.map((_, index) => {
        const row = weeklyQuery.data.find((target) => target.dayOfWeek === index);
        if (!row) return emptyDayForm();
        return {
          calories: String(roundMacroValue(row.calories)),
          protein: String(roundMacroValue(row.proteinG)),
          fat: String(roundMacroValue(row.fatG)),
          carbs: String(roundMacroValue(row.carbsG)),
        };
      }),
    );
  }, [weeklyQuery.data]);

  const updateDay = (index: number, field: keyof DayForm, value: string) => {
    setForms((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const hasInvalidDay = forms.some((form) => {
    if (!macroFormHasValues(form)) return false;
    return !getMacroCaloriesValidation(form).isValid;
  });

  const saveAll = async () => {
    setSaving(true);
    setMessage('');
    setMessageIsError(false);
    try {
      const userId = api.getUserId();
      for (let dayOfWeek = 0; dayOfWeek < WEEKDAYS.length; dayOfWeek += 1) {
        const form = forms[dayOfWeek];
        const hasValues = form.calories || form.protein || form.fat || form.carbs;
        if (!hasValues) continue;

        const input = {
          dayOfWeek: dayOfWeek as WeekdayIndex,
          calories: Number(form.calories) || 0,
          proteinG: Number(form.protein) || 0,
          fatG: Number(form.fat) || 0,
          carbsG: Number(form.carbs) || 0,
        };

        const validationError = macroCaloriesError(
          input.calories,
          input.proteinG,
          input.fatG,
          input.carbsG,
        );
        if (validationError) {
          throw new Error(`${WEEKDAYS[dayOfWeek]}: ${validationError}`);
        }

        if (userId) {
          await localStore.localUpsertWeeklyMacroTarget(userId, input);
        } else {
          await api.upsertWeeklyMacroTarget(input);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['weekly-macro-targets'] });
      await queryClient.invalidateQueries({ queryKey: ['macro-targets-effective'] });
      setMessage('Weekly default targets updated');
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save');
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  };

  if (weeklyQuery.isLoading) {
    return (
      <div>
        <PageHeader title="Weekly Targets" backTo="/settings" />
        <div className="flex justify-center py-16 text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Weekly Targets" backTo="/settings" />
      <div className="mx-auto w-full min-w-0 max-w-lg px-4 pb-8">
        <p className="my-4 text-sm text-muted-foreground">
          Set default macro targets for each day of the week. Individual dates can still be
          customized from the calendar. Calories should equal protein×4 + carbs×4 + fat×9.
        </p>

        {message && (
          <p className={cn('mb-4 text-sm', messageIsError ? 'text-destructive' : 'text-primary')}>
            {message}
          </p>
        )}

        {WEEKDAYS.map((dayName, index) => {
          const form = forms[index];
          const validation = getMacroCaloriesValidation(form);
          const invalid = validation.show && !validation.isValid;

          return (
            <Card key={dayName} className="mb-2.5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{dayName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  <MacroCaloriesInput
                    className="px-2 text-sm"
                    placeholder="Cal"
                    value={form.calories}
                    onChange={(value) => updateDay(index, 'calories', value)}
                    invalid={invalid}
                  />
                  <MacroCaloriesInput
                    className="px-2 text-sm"
                    placeholder="Protein"
                    value={form.protein}
                    onChange={(value) => updateDay(index, 'protein', value)}
                    invalid={invalid}
                  />
                  <MacroCaloriesInput
                    className="px-2 text-sm"
                    placeholder="Fat"
                    value={form.fat}
                    onChange={(value) => updateDay(index, 'fat', value)}
                    invalid={invalid}
                  />
                  <MacroCaloriesInput
                    className="px-2 text-sm"
                    placeholder="Carbs"
                    value={form.carbs}
                    onChange={(value) => updateDay(index, 'carbs', value)}
                    invalid={invalid}
                  />
                </div>
                <MacroCaloriesFeedback validation={validation} className="mt-2" />
              </CardContent>
            </Card>
          );
        })}

        <Button
          type="button"
          className="mt-2 w-full"
          size="lg"
          onClick={saveAll}
          disabled={saving || hasInvalidDay}
        >
          {saving ? 'Saving…' : 'Save weekly defaults'}
        </Button>
      </div>
    </div>
  );
}
