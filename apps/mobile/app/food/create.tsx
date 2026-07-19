import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { localCreateFood, localCreateFoodLog } from '../../lib/local-store';
import { todayDateString } from '../../lib/utils';
import { AppTextInput } from '../../components/AppTextInput';
import { colors } from '../../lib/theme';

type ServingDraft = {
  key: string;
  label: string;
  grams: string;
};

function newServingDraft(): ServingDraft {
  return { key: `${Date.now()}-${Math.random()}`, label: '', grams: '' };
}

export default function CreateFoodScreen() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servings, setServings] = useState<ServingDraft[]>([newServingDraft()]);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');

  const updateServing = (key: string, patch: Partial<ServingDraft>) => {
    setServings((prev) =>
      prev.map((serving) => (serving.key === key ? { ...serving, ...patch } : serving)),
    );
  };

  const removeServing = (key: string) => {
    setServings((prev) => {
      const next = prev.filter((serving) => serving.key !== key);
      return next.length > 0 ? next : [newServingDraft()];
    });
  };

  const handleSave = async () => {
    if (!name) {
      Alert.alert('Error', 'Food name is required');
      return;
    }

    const servingSizes: { label: string; grams: number }[] = [];
    for (const serving of servings) {
      if (!serving.label.trim() && !serving.grams.trim()) continue;
      const grams = Number(serving.grams);
      if (!serving.label.trim() || !Number.isFinite(grams) || grams <= 0) {
        Alert.alert('Error', 'Each unit needs a name and a positive weight in grams');
        return;
      }
      servingSizes.push({ label: serving.label.trim(), grams });
    }

    const nutrientsPer100g = {
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      carbs: Number(carbs) || 0,
    };

    try {
      const userId = api.getUserId();
      let foodId: string;
      const payload = {
        name,
        brand: brand || undefined,
        source: 'user' as const,
        nutrientsPer100g,
        servingSizes: servingSizes.length > 0 ? servingSizes : undefined,
      };

      if (userId) {
        const food = await localCreateFood(userId, payload);
        foodId = food.id;
        await localCreateFoodLog(userId, {
          loggedAt: new Date().toISOString(),
          mealSlot: 'snack',
          foodId,
          quantity: 100,
          unit: 'g',
        });
      } else {
        const food = (await api.createFood(payload)) as { id: string };
        foodId = food.id;
        await api.createFoodLog({
          loggedAt: new Date().toISOString(),
          mealSlot: 'snack',
          foodId,
          quantity: 100,
          unit: 'g',
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['foods'] });
      await queryClient.invalidateQueries({ queryKey: ['food-logs'] });

      Alert.alert('Saved', 'Food created and logged (100g)', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.hint}>Enter nutrition values per 100g</Text>

      <AppTextInput
        style={styles.input}
        placeholder="Food name *"
        value={name}
        onChangeText={setName}
      />
      <AppTextInput
        style={styles.input}
        placeholder="Brand (optional)"
        value={brand}
        onChangeText={setBrand}
      />

      <Text style={styles.sectionLabel}>Units & amount (optional)</Text>
      <Text style={styles.sectionHint}>
        e.g. scoop = 30g — used when logging in that unit
      </Text>
      {servings.map((serving) => (
        <View key={serving.key} style={styles.servingRow}>
          <AppTextInput
            style={[styles.input, styles.unitInput]}
            placeholder="Unit (e.g. scoop)"
            value={serving.label}
            onChangeText={(value) => updateServing(serving.key, { label: value })}
          />
          <AppTextInput
            style={[styles.input, styles.gramsInput]}
            placeholder="g"
            keyboardType="numeric"
            value={serving.grams}
            onChangeText={(value) => updateServing(serving.key, { grams: value })}
          />
          <TouchableOpacity onPress={() => removeServing(serving.key)} style={styles.removeBtn}>
            <Text style={styles.removeText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => setServings((prev) => [...prev, newServingDraft()])}
      >
        <Text style={styles.secondaryButtonText}>Add unit</Text>
      </TouchableOpacity>

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

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Save & Log 100g</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  hint: { color: colors.textMuted, marginBottom: 16 },
  sectionLabel: {
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 4,
  },
  sectionHint: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  input: { marginBottom: 10 },
  servingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unitInput: { flex: 1, marginBottom: 10 },
  gramsInput: { width: 72, marginBottom: 10 },
  removeBtn: { paddingHorizontal: 8, paddingBottom: 10 },
  removeText: { color: colors.danger, fontSize: 16 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '500' },
  button: {
    backgroundColor: colors.primaryDark,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  buttonText: { color: colors.onPrimary, fontWeight: '600' },
});
