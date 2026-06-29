import { useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { api } from '../../lib/api';
import { localRemoveMacroTarget, localUpsertMacroTarget } from '../../lib/local-store';
import { computeNutrients, sumNutrients } from '../../lib/utils';
import type {
  EffectiveMacroTarget,
  Food,
  FoodLogEntry,
  MealPlanEntry,
  Nutrients,
} from '@calorie-tracker/shared';
import { WEEKDAYS, formatNutrientsSummary } from '@calorie-tracker/shared';
import { MacroProgress } from '../../components/MacroProgress';
import { AppTextInput } from '../../components/AppTextInput';
import { colors } from '../../lib/theme';

type Tab = 'targets' | 'plan' | 'log';

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('targets');

  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');

  const effectiveQuery = useQuery({
    queryKey: ['macro-targets-effective', date],
    queryFn: () =>
      api.getEffectiveMacroTargets(date!, date!) as Promise<EffectiveMacroTarget[]>,
    enabled: !!date,
  });

  const planQuery = useQuery({
    queryKey: ['meal-plans', date],
    queryFn: () => api.getMealPlans(date!) as Promise<MealPlanEntry[]>,
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

  const consumed = computeEntries(logsQuery.data ?? []);
  const planned = computeEntries(planQuery.data ?? []);

  const saveOverride = async () => {
    if (!date) return;
    try {
      const userId = api.getUserId();
      const input = {
        targetDate: date,
        calories: Number(calories) || 0,
        proteinG: Number(protein) || 0,
        fatG: Number(fat) || 0,
        carbsG: Number(carbs) || 0,
      };

      if (userId) {
        await localUpsertMacroTarget(userId, input);
      } else {
        await api.upsertMacroTarget(input);
      }

      await queryClient.invalidateQueries({ queryKey: ['macro-targets-effective'] });
      Alert.alert('Saved', 'Custom target saved for this day');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save');
    }
  };

  const resetToWeeklyDefault = async () => {
    if (!effective?.overrideId) return;
    try {
      const userId = api.getUserId();
      if (userId) {
        await localRemoveMacroTarget(userId, effective.overrideId);
      } else {
        await api.deleteMacroTarget(effective.overrideId);
      }

      await queryClient.invalidateQueries({ queryKey: ['macro-targets-effective'] });

      if (effective.weeklyDayOfWeek !== undefined) {
        const weeklyQuery = await api.getWeeklyMacroTargets() as Array<{
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

      Alert.alert('Reset', 'This day now uses the weekly default target');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to reset');
    }
  };

  if (!date) return null;

  const sourceLabel =
    effective?.source === 'override'
      ? 'Custom override for this date'
      : effective?.source === 'weekly'
        ? `Weekly default (${WEEKDAYS[effective.weeklyDayOfWeek ?? 0]})`
        : 'No target set';

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.date}>{date}</Text>
      <Text style={styles.source}>{sourceLabel}</Text>

      <View style={styles.tabs}>
        {(['targets', 'plan', 'log'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'targets' ? 'Targets' : t === 'plan' ? 'Meal Plan' : 'Log'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'targets' && (
        <View style={styles.section}>
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

          <Text style={styles.sectionTitle}>Set target for this day</Text>
          <Text style={styles.hint}>
            Saving here creates a one-off override. Leave unchanged to keep using the weekly
            default.
          </Text>
          <AppTextInput
            style={styles.input}
            placeholder="Calories"
            keyboardType="numeric"
            value={calories}
            onChangeText={setCalories}
          />
          <AppTextInput
            style={styles.input}
            placeholder="Protein (g)"
            keyboardType="numeric"
            value={protein}
            onChangeText={setProtein}
          />
          <AppTextInput
            style={styles.input}
            placeholder="Fat (g)"
            keyboardType="numeric"
            value={fat}
            onChangeText={setFat}
          />
          <AppTextInput
            style={styles.input}
            placeholder="Carbs (g)"
            keyboardType="numeric"
            value={carbs}
            onChangeText={setCarbs}
          />
          <TouchableOpacity style={styles.button} onPress={saveOverride}>
            <Text style={styles.buttonText}>Save custom target</Text>
          </TouchableOpacity>
          {effective?.source === 'override' && (
            <TouchableOpacity style={styles.secondaryButton} onPress={resetToWeeklyDefault}>
              <Text style={styles.secondaryButtonText}>Use weekly default instead</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {tab === 'plan' && (
        <View style={styles.section}>
          <TotalsSummary label="Planned totals" nutrients={planned} />
          {(planQuery.data ?? []).map((entry) => {
            const food = foodsMap.get(entry.foodId);
            return (
              <View key={entry.id} style={styles.entry}>
                <Text style={styles.entryName}>{food?.name ?? 'Unknown'}</Text>
                <Text style={styles.entryMeta}>
                  {entry.mealSlot} · {entry.quantity}{entry.unit}
                </Text>
              </View>
            );
          })}
          {(planQuery.data ?? []).length === 0 && (
            <Text style={styles.empty}>No meal plan entries. Add foods from search.</Text>
          )}
        </View>
      )}

      {tab === 'log' && (
        <View style={styles.section}>
          <TotalsSummary label="Logged totals" nutrients={consumed} />
          {(logsQuery.data ?? []).map((entry) => {
            const food = foodsMap.get(entry.foodId);
            return (
              <View key={entry.id} style={styles.entry}>
                <Text style={styles.entryName}>{food?.name ?? 'Unknown'}</Text>
                <Text style={styles.entryMeta}>
                  {entry.mealSlot} · {entry.quantity}{entry.unit}
                </Text>
              </View>
            );
          })}
          {(logsQuery.data ?? []).length === 0 && (
            <Text style={styles.empty}>Nothing logged for this day.</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function TotalsSummary({ label, nutrients }: { label: string; nutrients: Nutrients }) {
  return (
    <View style={styles.totals}>
      <Text style={styles.totalsLabel}>{label}</Text>
      <Text style={styles.totalsValues}>{formatNutrientsSummary(nutrients)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  date: { fontSize: 20, fontWeight: '700', padding: 16, paddingBottom: 4, color: colors.text },
  source: { paddingHorizontal: 16, color: colors.textMuted, marginBottom: 8 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tabActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  tabText: { fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.onPrimary },
  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: colors.text },
  hint: { color: colors.textMuted, marginBottom: 12, lineHeight: 20 },
  input: { marginBottom: 8 },
  button: {
    backgroundColor: colors.primaryDark,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: colors.onPrimary, fontWeight: '600' },
  secondaryButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: { color: colors.textSecondary, fontWeight: '600' },
  entry: { backgroundColor: colors.surface, padding: 12, borderRadius: 8, marginBottom: 8 },
  entryName: { fontWeight: '600', fontSize: 15, color: colors.text },
  entryMeta: { color: colors.textMuted, marginTop: 4, textTransform: 'capitalize' },
  empty: { color: colors.textMuted, fontStyle: 'italic' },
  totals: { backgroundColor: colors.surface, padding: 12, borderRadius: 8, marginBottom: 12 },
  totalsLabel: { fontWeight: '600', marginBottom: 4, color: colors.text },
  totalsValues: { color: colors.textSecondary },
});
