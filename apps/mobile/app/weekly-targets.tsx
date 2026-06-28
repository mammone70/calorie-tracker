import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { localUpsertWeeklyMacroTarget } from '../lib/local-store';
import { WEEKDAYS, type WeeklyMacroTarget, type WeekdayIndex } from '@calorie-tracker/shared';
import { AppTextInput } from '../components/AppTextInput';
import { colors } from '../lib/theme';

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

export default function WeeklyTargetsScreen() {
  const queryClient = useQueryClient();
  const [forms, setForms] = useState<DayForm[]>(() => WEEKDAYS.map(() => emptyDayForm()));
  const [saving, setSaving] = useState(false);

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
          calories: String(row.calories),
          protein: String(row.proteinG),
          fat: String(row.fatG),
          carbs: String(row.carbsG),
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

  const saveAll = async () => {
    setSaving(true);
    try {
      const userId = api.getUserId();
      for (let dayOfWeek = 0; dayOfWeek < WEEKDAYS.length; dayOfWeek += 1) {
        const form = forms[dayOfWeek];
        const calories = Number(form.calories);
        const proteinG = Number(form.protein);
        const fatG = Number(form.fat);
        const carbsG = Number(form.carbs);
        const hasValues = form.calories || form.protein || form.fat || form.carbs;
        if (!hasValues) continue;

        const input = {
          dayOfWeek: dayOfWeek as WeekdayIndex,
          calories: Number.isFinite(calories) ? calories : 0,
          proteinG: Number.isFinite(proteinG) ? proteinG : 0,
          fatG: Number.isFinite(fatG) ? fatG : 0,
          carbsG: Number.isFinite(carbsG) ? carbsG : 0,
        };

        if (userId) {
          await localUpsertWeeklyMacroTarget(userId, input);
        } else {
          await api.upsertWeeklyMacroTarget(input);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['weekly-macro-targets'] });
      await queryClient.invalidateQueries({ queryKey: ['macro-targets-effective'] });
      Alert.alert('Saved', 'Weekly default targets updated');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (weeklyQuery.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Set default macro targets for each day of the week. Individual dates can still be
        customized from the calendar.
      </Text>

      {WEEKDAYS.map((dayName, index) => (
        <View key={dayName} style={styles.dayCard}>
          <Text style={styles.dayTitle}>{dayName}</Text>
          <View style={styles.row}>
            <AppTextInput
              style={[styles.input, styles.inputQuarter]}
              placeholder="Cal"
              keyboardType="numeric"
              value={forms[index].calories}
              onChangeText={(value) => updateDay(index, 'calories', value)}
            />
            <AppTextInput
              style={[styles.input, styles.inputQuarter]}
              placeholder="Protein"
              keyboardType="numeric"
              value={forms[index].protein}
              onChangeText={(value) => updateDay(index, 'protein', value)}
            />
            <AppTextInput
              style={[styles.input, styles.inputQuarter]}
              placeholder="Fat"
              keyboardType="numeric"
              value={forms[index].fat}
              onChangeText={(value) => updateDay(index, 'fat', value)}
            />
            <AppTextInput
              style={[styles.input, styles.inputQuarter]}
              placeholder="Carbs"
              keyboardType="numeric"
              value={forms[index].carbs}
              onChangeText={(value) => updateDay(index, 'carbs', value)}
            />
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={saveAll} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save weekly defaults'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  intro: { color: colors.textMuted, marginBottom: 16, lineHeight: 20 },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  dayTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: colors.text },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    marginBottom: 0,
    padding: 10,
    fontSize: 14,
  },
  inputQuarter: { flex: 1 },
  button: {
    backgroundColor: colors.primaryDark,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: colors.onPrimary, fontWeight: '600' },
});
