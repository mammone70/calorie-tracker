import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/client';
import { todayDateString } from '@calorie-tracker/client';
import type { Food } from '@calorie-tracker/shared';

export function FoodsPage() {
  const { sync } = useAuth();
  const today = todayDateString();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.getFoods() as Promise<Food[]>,
  });

  const onRefresh = async () => {
    await sync();
    await refetch();
  };

  return (
    <div className="mx-auto max-w-lg pb-4">
      <div className="space-y-2 p-4">
        <Link to={`/foods/log?date=${today}`} className="btn-primary block text-center">
          Log food for today
        </Link>
        <Link to="/foods/search" className="btn-secondary block text-center">
          Search external foods
        </Link>
        <Link to="/foods/new" className="btn-secondary block text-center">
          + Manual entry
        </Link>
        <button type="button" onClick={onRefresh} className="link w-full text-center text-sm">
          Refresh list
        </button>
      </div>

      {(data ?? []).length === 0 ? (
        <p className="px-6 text-center text-muted">
          {isLoading ? 'Loading…' : 'No saved foods yet. Search or add manually.'}
        </p>
      ) : (
        <ul className="space-y-2 px-4">
          {(data ?? []).map((item) => (
            <li key={item.id} className="card">
              <p className="font-semibold">{item.name}</p>
              {item.brand && <p className="text-sm text-muted">{item.brand}</p>}
              <p className="mt-1.5 text-sm text-foreground-secondary">
                {item.nutrientsPer100g.calories} cal · P {item.nutrientsPer100g.protein}g · F{' '}
                {item.nutrientsPer100g.fat}g · C {item.nutrientsPer100g.carbs}g (per 100g)
              </p>
              <p className="mt-1 text-xs capitalize text-muted">{item.source}</p>
              <Link
                to={`/foods/log?foodId=${item.id}&date=${today}`}
                className="link mt-2 inline-block text-sm"
              >
                Log today
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
