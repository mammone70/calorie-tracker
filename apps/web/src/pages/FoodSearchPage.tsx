import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { api, localStore } from '../lib/client';
import { todayDateString } from '@calorie-tracker/client';
import type { FoodSearchResult } from '@calorie-tracker/shared';

export function FoodSearchPage() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: ['food-search', searchTerm],
    queryFn: () => api.searchFoods(searchTerm) as Promise<FoodSearchResult[]>,
    enabled: searchTerm.length >= 2,
  });

  const saveFood = async (item: FoodSearchResult) => {
    setMessage('');
    try {
      const userId = api.getUserId();
      let foodId: string;

      if (userId) {
        const food = await localStore.localCreateFood(userId, {
          name: item.name,
          brand: item.brand,
          source: item.source,
          externalId: item.externalId,
          nutrientsPer100g: item.nutrientsPer100g,
          servingSizes: item.servingSizes,
        });
        foodId = food.id;
      } else {
        const food = (await api.createFood({
          name: item.name,
          brand: item.brand,
          source: item.source,
          externalId: item.externalId,
          nutrientsPer100g: item.nutrientsPer100g,
          servingSizes: item.servingSizes,
        })) as { id: string };
        foodId = food.id;
      }

      await queryClient.invalidateQueries({ queryKey: ['foods'] });

      setMessage(`${item.name} saved — choose a meal to log it`);
      setTimeout(
        () => navigate(`/foods/log?foodId=${foodId}&date=${todayDateString()}`),
        800,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save food');
    }
  };

  return (
    <div>
      <PageHeader title="Search Foods" backTo="/foods" />
      <div className="mx-auto max-w-lg px-4 pb-8">
        <div className="my-4 flex gap-2">
          <input
            className="input-field mb-0 flex-1"
            placeholder="Search USDA & Open Food Facts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearchTerm(query)}
          />
          <button type="button" className="btn-primary shrink-0" onClick={() => setSearchTerm(query)}>
            Search
          </button>
        </div>

        {message && <p className="mb-4 text-sm text-primary">{message}</p>}

        {searchTerm.length >= 2 && isFetching && <p className="text-muted">Searching…</p>}

        <ul className="space-y-2">
          {(data ?? []).map((item) => (
            <li key={`${item.source}:${item.externalId}`}>
              <button
                type="button"
                onClick={() => void saveFood(item)}
                className="card w-full border border-border-light text-left"
              >
                <p className="font-semibold">{item.name}</p>
                {item.brand && <p className="text-sm text-muted">{item.brand}</p>}
                <p className="mt-1.5 text-sm text-foreground-secondary">
                  {item.nutrientsPer100g.calories} cal · P {item.nutrientsPer100g.protein}g · F{' '}
                  {item.nutrientsPer100g.fat}g · C {item.nutrientsPer100g.carbs}g / 100g
                </p>
                <p className="mt-1 text-xs capitalize text-muted">
                  {item.source.replace('_', ' ')}
                </p>
              </button>
            </li>
          ))}
        </ul>

        {searchTerm.length >= 2 && !isFetching && (data ?? []).length === 0 && (
          <p className="py-6 text-center text-muted">
            No results. Try a different term or add manually. Note: USDA search requires an API key
            on the server.
          </p>
        )}
      </div>
    </div>
  );
}
