import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { api } from '../../lib/api';
import { localUpsertMacroTarget } from '../../lib/local-store';
import { computeNutrients, sumNutrients } from '../../lib/utils';
import type {
  Food,
  FoodLogEntry,
  MacroTarget,
  MealPlanEntry,
  Nutrients,
} from '@calorie-tracker/shared';
import { MacroProgress } from '../../components/MacroProgress';

type Tab = 'targets' | 'plan' | 'log';

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('targets');

  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');

  const targetsQuery = useQuery({
    queryKey: ['macro-targets', date],
    queryFn: () => api.getMacroTargets(date!, date!) as Promise<MacroTarget[]>,
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

  const target = targetsQuery.data?.[0];
  const foodsMap = new Map((foodsQuery.data ?? []).map((f) => [f.id, f]));

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

  const saveTargets = async () => {
    if (!date) return;
    try {
      const userId = api.getUserId();
      if (userId) {
        await localUpsertMacroTarget(userId, {
          targetDate: date,
          calories: Number(calories) || 0,
          proteinG: Number(protein) || 0,
          fatG: Number(fat) || 0,
          carbsG: Number(carbs) || 0,
        });
      } else {
        await api.upsertMacroTarget({
          targetDate: date,
          calories: Number(calories) || 0,
          proteinG: Number(protein) || 0,
          fatG: Number(fat) || 0,
          carbsG: Number(carbs) || 0,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['macro-targets'] });
      Alert.alert('Saved', 'Macro targets updated');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save');
    }
  };

  if (!date) return null;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.date}>{date}</Text>

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
          {target && (
            <MacroProgress
              label="Progress vs Target"
              consumed={consumed}
              target={{
                calories: target.calories,
                protein: target.proteinG,
                fat: target.fatG,
                carbs: target.carbsG,
              }}
            />
          )}

          <Text style={styles.sectionTitle}>Set Macro Targets</Text>
          <TextInput
            style={styles.input}
            placeholder={`Calories${target ? ` (current: ${target.calories})` : ''}`}
            keyboardType="numeric"
            value={calories}
            onChangeText={setCalories}
          />
          <TextInput
            style={styles.input}
            placeholder={`Protein (g)${target ? ` (current: ${target.proteinG})` : ''}`}
            keyboardType="numeric"
            value={protein}
            onChangeText={setProtein}
          />
          <TextInput
            style={styles.input}
            placeholder={`Fat (g)${target ? ` (current: ${target.fatG})` : ''}`}
            keyboardType="numeric"
            value={fat}
            onChangeText={setFat}
          />
          <TextInput
            style={styles.input}
            placeholder={`Carbs (g)${target ? ` (current: ${target.carbsG})` : ''}`}
            keyboardType="numeric"
            value={carbs}
            onChangeText={setCarbs}
          />
          <TouchableOpacity style={styles.button} onPress={saveTargets}>
            <Text style={styles.buttonText}>Save Targets</Text>
          </TouchableOpacity>
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
      <Text style={styles.totalsValues}>
        {nutrients.calories} cal · P {nutrients.protein}g · F {nutrients.fat}g · C {nutrients.carbs}g
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  date: { fontSize: 20, fontWeight: '700', padding: 16, paddingBottom: 8 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabText: { fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#fff' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  entry: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8 },
  entryName: { fontWeight: '600', fontSize: 15 },
  entryMeta: { color: '#64748b', marginTop: 4, textTransform: 'capitalize' },
  empty: { color: '#94a3b8', fontStyle: 'italic' },
  totals: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 },
  totalsLabel: { fontWeight: '600', marginBottom: 4 },
  totalsValues: { color: '#475569' },
});
