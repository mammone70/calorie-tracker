import { useQuery } from '@tanstack/react-query';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { todayDateString, computeNutrients, sumNutrients } from '../../lib/utils';
import type { Food, FoodLogEntry, MacroTarget, Nutrients } from '@calorie-tracker/shared';
import { useAuth } from '../../contexts/AuthContext';
import { MacroProgress } from '../../components/MacroProgress';

export default function TodayScreen() {
  const today = todayDateString();
  const { sync } = useAuth();

  const targetsQuery = useQuery({
    queryKey: ['macro-targets', today],
    queryFn: () => api.getMacroTargets(today, today) as Promise<MacroTarget[]>,
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
  const foodsMap = new Map((foodsQuery.data ?? []).map((f) => [f.id, f]));

  const consumed: Nutrients = sumNutrients(
    (logsQuery.data ?? [])
      .map((log) => {
        const food = foodsMap.get(log.foodId);
        if (!food) return { calories: 0, protein: 0, fat: 0, carbs: 0 };
        const grams = log.unit === 'g' ? log.quantity : log.quantity;
        return computeNutrients(food.nutrientsPer100g, grams);
      }),
  );

  const onRefresh = async () => {
    await sync();
    await Promise.all([targetsQuery.refetch(), logsQuery.refetch(), foodsQuery.refetch()]);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl onRefresh={onRefresh} />}
    >
      <Text style={styles.date}>{today}</Text>

      {target ? (
        <MacroProgress
          label="Today's Progress"
          consumed={consumed}
          target={{
            calories: target.calories,
            protein: target.proteinG,
            fat: target.fatG,
            carbs: target.carbsG,
          }}
        />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No macro target set</Text>
          <TouchableOpacity onPress={() => router.push(`/day/${today}`)}>
            <Text style={styles.link}>Set targets for today</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Logged Today</Text>
          <TouchableOpacity onPress={() => router.push('/food/search')}>
            <Text style={styles.link}>+ Add food</Text>
          </TouchableOpacity>
        </View>

        {(logsQuery.data ?? []).length === 0 ? (
          <Text style={styles.empty}>No foods logged yet</Text>
        ) : (
          (logsQuery.data ?? []).map((log) => {
            const food = foodsMap.get(log.foodId);
            return (
              <View key={log.id} style={styles.logItem}>
                <Text style={styles.logName}>{food?.name ?? 'Unknown food'}</Text>
                <Text style={styles.logMeta}>
                  {log.mealSlot} · {log.quantity}{log.unit}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <TouchableOpacity style={styles.dayButton} onPress={() => router.push(`/day/${today}`)}>
        <Text style={styles.dayButtonText}>View full day details</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  date: { fontSize: 14, color: '#64748b', padding: 16, paddingBottom: 0 },
  card: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  link: { color: '#2563eb', fontWeight: '600' },
  section: { margin: 16, marginTop: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  empty: { color: '#94a3b8', fontStyle: 'italic' },
  logItem: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8 },
  logName: { fontSize: 16, fontWeight: '600' },
  logMeta: { color: '#64748b', marginTop: 4, textTransform: 'capitalize' },
  dayButton: {
    margin: 16,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dayButtonText: { color: '#2563eb', fontWeight: '600' },
});
