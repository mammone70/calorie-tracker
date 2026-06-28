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
        refreshControl={<RefreshControl onRefresh={onRefresh} />}
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 16, gap: 8 },
  searchButton: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  searchButtonText: { color: '#fff', fontWeight: '600' },
  addButton: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  addButtonText: { color: '#2563eb', fontWeight: '600' },
  empty: { padding: 24, textAlign: 'center', color: '#94a3b8' },
  item: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 8 },
  name: { fontSize: 16, fontWeight: '600' },
  brand: { color: '#64748b', marginTop: 2 },
  macros: { color: '#475569', marginTop: 6, fontSize: 13 },
  source: { color: '#94a3b8', marginTop: 4, fontSize: 12, textTransform: 'capitalize' },
});
