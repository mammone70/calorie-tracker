import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { View, StyleSheet, Text } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import type { MacroTarget } from '@calorie-tracker/shared';

export default function CalendarScreen() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const from = `${selectedMonth}-01`;
  const to = `${selectedMonth}-31`;

  const { data: targets } = useQuery({
    queryKey: ['macro-targets', from, to],
    queryFn: () => api.getMacroTargets(from, to) as Promise<MacroTarget[]>,
  });

  const markedDates = (targets ?? []).reduce<
    Record<string, { marked: boolean; dotColor: string; selectedColor?: string }>
  >((acc, target) => {
    acc[target.targetDate] = { marked: true, dotColor: '#2563eb' };
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>Tap a day to view or edit targets, meal plan, and logs</Text>
      <Calendar
        markedDates={markedDates}
        onDayPress={(day) => router.push(`/day/${day.dateString}`)}
        onMonthChange={(month) => {
          const monthStr = `${month.year}-${String(month.month).padStart(2, '0')}`;
          setSelectedMonth(monthStr);
        }}
        theme={{
          todayTextColor: '#2563eb',
          arrowColor: '#2563eb',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 8 },
  hint: { padding: 16, color: '#64748b', fontSize: 14 },
});
