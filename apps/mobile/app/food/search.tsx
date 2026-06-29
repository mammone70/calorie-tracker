import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { localCreateFood, localCreateFoodLog } from '../../lib/local-store';
import { todayDateString } from '../../lib/utils';
import type { FoodSearchResult } from '@calorie-tracker/shared';
import { formatNutrientsSummary } from '@calorie-tracker/shared';
import { AppTextInput } from '../../components/AppTextInput';
import { colors } from '../../lib/theme';

export default function FoodSearchScreen() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ['food-search', searchTerm],
    queryFn: () => api.searchFoods(searchTerm) as Promise<FoodSearchResult[]>,
    enabled: searchTerm.length >= 2,
  });

  const saveAndLog = async (item: FoodSearchResult) => {
    try {
      const userId = api.getUserId();

      if (userId) {
        const food = await localCreateFood(userId, {
          name: item.name,
          brand: item.brand,
          source: item.source,
          externalId: item.externalId,
          nutrientsPer100g: item.nutrientsPer100g,
          servingSizes: item.servingSizes,
        });
        await localCreateFoodLog(userId, {
          loggedAt: new Date().toISOString(),
          mealSlot: 'snack',
          foodId: food.id,
          quantity: 100,
          unit: 'g',
        });
      } else {
        const food = await api.createFood({
          name: item.name,
          brand: item.brand,
          source: item.source,
          externalId: item.externalId,
          nutrientsPer100g: item.nutrientsPer100g,
          servingSizes: item.servingSizes,
        }) as { id: string };

        await api.createFoodLog({
          loggedAt: new Date().toISOString(),
          mealSlot: 'snack',
          foodId: food.id,
          quantity: 100,
          unit: 'g',
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['foods'] });
      await queryClient.invalidateQueries({ queryKey: ['food-logs'] });

      Alert.alert('Saved', `${item.name} added to your foods and logged (100g)`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save food');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <AppTextInput
          style={styles.input}
          placeholder="Search USDA & Open Food Facts..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => setSearchTerm(query)}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={() => setSearchTerm(query)}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {searchTerm.length >= 2 && isFetching && (
        <Text style={styles.status}>Searching...</Text>
      )}

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => `${item.source}:${item.externalId}`}
        ListEmptyComponent={
          searchTerm.length >= 2 && !isFetching ? (
            <Text style={styles.empty}>
              No results. Try a different term or add manually. Note: USDA search requires an API key on the server.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => saveAndLog(item)}>
            <Text style={styles.name}>{item.name}</Text>
            {item.brand ? <Text style={styles.brand}>{item.brand}</Text> : null}
            <Text style={styles.macros}>
              {formatNutrientsSummary(item.nutrientsPer100g)} / 100g
            </Text>
            <Text style={styles.source}>{item.source.replace('_', ' ')}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchRow: { flexDirection: 'row', padding: 16, gap: 8 },
  input: {
    flex: 1,
    marginBottom: 0,
  },
  searchButton: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  searchButtonText: { color: colors.onPrimary, fontWeight: '600' },
  status: { paddingHorizontal: 16, color: colors.textMuted },
  empty: { padding: 24, textAlign: 'center', color: colors.textMuted },
  item: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 8,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  brand: { color: colors.textMuted, marginTop: 2 },
  macros: { color: colors.textSecondary, marginTop: 6, fontSize: 13 },
  source: { color: colors.textMuted, marginTop: 4, fontSize: 12, textTransform: 'capitalize' },
});
