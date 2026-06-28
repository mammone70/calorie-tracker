import { useQuery } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import type { Food } from '@calorie-tracker/shared';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../lib/theme';

export default function FoodsScreen() {
  const { sync } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.getFoods() as Promise<Food[]>,
  });

  const onRefresh = async () => {
    await sync();
    await refetch();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.searchButton} onPress={() => router.push('/food/search')}>
          <Text style={styles.searchButtonText}>Search external foods</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/food/create')}>
          <Text style={styles.addButtonText}>+ Manual entry</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isLoading ? 'Loading...' : 'No saved foods yet. Search or add manually.'}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.name}>{item.name}</Text>
            {item.brand ? <Text style={styles.brand}>{item.brand}</Text> : null}
            <Text style={styles.macros}>
              {item.nutrientsPer100g.calories} cal · P {item.nutrientsPer100g.protein}g · F{' '}
              {item.nutrientsPer100g.fat}g · C {item.nutrientsPer100g.carbs}g (per 100g)
            </Text>
            <Text style={styles.source}>{item.source}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, gap: 8 },
  searchButton: {
    backgroundColor: colors.primaryDark,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  searchButtonText: { color: colors.onPrimary, fontWeight: '600' },
  addButton: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  addButtonText: { color: colors.primary, fontWeight: '600' },
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
