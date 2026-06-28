import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
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

export default function CreateFoodScreen() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');

  const handleSave = async () => {
    if (!name) {
      Alert.alert('Error', 'Food name is required');
      return;
    }

    try {
      const userId = api.getUserId();
      let foodId: string;

      if (userId) {
        const food = await localCreateFood(userId, {
          name,
          brand: brand || undefined,
          source: 'user',
          nutrientsPer100g: {
            calories: Number(calories) || 0,
            protein: Number(protein) || 0,
            fat: Number(fat) || 0,
            carbs: Number(carbs) || 0,
          },
        });
        foodId = food.id;
        await localCreateFoodLog(userId, {
          loggedAt: new Date().toISOString(),
          mealSlot: 'snack',
          foodId,
          quantity: 100,
          unit: 'g',
        });
      } else {
        const food = await api.createFood({
          name,
          brand: brand || undefined,
          source: 'user',
          nutrientsPer100g: {
            calories: Number(calories) || 0,
            protein: Number(protein) || 0,
            fat: Number(fat) || 0,
            carbs: Number(carbs) || 0,
          },
        }) as { id: string };
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

      <TextInput style={styles.input} placeholder="Food name *" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Brand (optional)" value={brand} onChangeText={setBrand} />
      <TextInput style={styles.input} placeholder="Calories" keyboardType="numeric" value={calories} onChangeText={setCalories} />
      <TextInput style={styles.input} placeholder="Protein (g)" keyboardType="numeric" value={protein} onChangeText={setProtein} />
      <TextInput style={styles.input} placeholder="Fat (g)" keyboardType="numeric" value={fat} onChangeText={setFat} />
      <TextInput style={styles.input} placeholder="Carbs (g)" keyboardType="numeric" value={carbs} onChangeText={setCarbs} />

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Save & Log 100g</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  hint: { color: '#64748b', marginBottom: 16 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
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
});
