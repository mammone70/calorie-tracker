import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { View, StyleSheet, Text } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';
import type { EffectiveMacroTarget } from '@calorie-tracker/shared';

export default function CalendarScreen() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const from = `${selectedMonth}-01`;
  const to = `${selectedMonth}-31`;

  const { data: targets } = useQuery({
    queryKey: ['macro-targets-effective', from, to],
    queryFn: () => api.getEffectiveMacroTargets(from, to) as Promise<EffectiveMacroTarget[]>,
  });

  const markedDates = (targets ?? []).reduce<
    Record<string, { marked: boolean; dotColor: string; selectedColor?: string }>
  >((acc, target) => {
    if (target.source === 'none') return acc;
    acc[target.targetDate] = {
      marked: true,
      dotColor: target.source === 'override' ? colors.dotOverride : colors.dotWeekly,
    };
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Tap a day to view or edit targets. Blue dot = weekly default, red dot = custom override.
      </Text>
      <Calendar
        markedDates={markedDates}
        onDayPress={(day) => router.push(`/day/${day.dateString}`)}
        onMonthChange={(month) => {
          const monthStr = `${month.year}-${String(month.month).padStart(2, '0')}`;
          setSelectedMonth(monthStr);
        }}
        theme={{
          backgroundColor: colors.background,
          calendarBackground: colors.background,
          textSectionTitleColor: colors.textMuted,
          selectedDayBackgroundColor: colors.primary,
          todayTextColor: colors.primary,
          dayTextColor: colors.text,
          textDisabledColor: colors.textMuted,
          arrowColor: colors.primary,
          monthTextColor: colors.text,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 8 },
  hint: { padding: 16, color: colors.textMuted, fontSize: 14 },
});
