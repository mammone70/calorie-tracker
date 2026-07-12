import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { formatFoodLabel } from '../components/FoodPicker';
import { api } from '../lib/client';
import { todayDateString } from '@calorie-tracker/client';
import { formatNutrientsSummary, type Food } from '@calorie-tracker/shared';
import { cn, inputFieldClass } from '@/lib/utils';

export function FoodsPage() {
  const { sync } = useAuth();
  const today = todayDateString();
  const [query, setQuery] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.getFoods() as Promise<Food[]>,
  });

  const foods = data ?? [];
  const filteredFoods = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return foods;
    return foods.filter((food) => formatFoodLabel(food).toLowerCase().includes(normalized));
  }, [foods, query]);

  const onRefresh = async () => {
    await sync();
    await refetch();
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-lg px-4 pb-4">
      <div className="space-y-2 p-4">
        <Input
          type="search"
          role="searchbox"
          aria-label="Search saved foods"
          placeholder="Search saved foods…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={cn(inputFieldClass, 'mb-0')}
          autoComplete="off"
        />
        <Button className="w-full" size="lg" asChild>
          <Link to={`/foods/log?date=${today}`}>Log food for today</Link>
        </Button>
        <Button variant="outline" className="w-full" size="lg" asChild>
          <Link to="/foods/search">Search external foods</Link>
        </Button>
        <Button variant="outline" className="w-full" size="lg" asChild>
          <Link to="/foods/new">+ Manual entry</Link>
        </Button>
        <Button variant="link" className="w-full" onClick={onRefresh}>
          Refresh list
        </Button>
      </div>

      {foods.length === 0 ? (
        <p className="px-6 text-center text-muted-foreground">
          {isLoading ? 'Loading…' : 'No saved foods yet. Search or add manually.'}
        </p>
      ) : filteredFoods.length === 0 ? (
        <p className="px-6 text-center text-muted-foreground">
          No foods match “{query.trim()}”.
        </p>
      ) : (
        <ul className="space-y-2 px-4">
          {filteredFoods.map((item) => (
            <li key={item.id}>
              <Card>
                <CardHeader>
                  <CardTitle>{item.name}</CardTitle>
                  {item.brand && <CardDescription>{item.brand}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {formatNutrientsSummary(item.nutrientsPer100g)} (per 100g)
                  </p>
                  {(item.servingSizes ?? []).length > 0 && (
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {(item.servingSizes ?? []).map((serving) => (
                        <li key={`${serving.label}-${serving.grams}`}>
                          {serving.label}: {serving.grams}g
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs capitalize text-muted-foreground">{item.source}</p>
                  <div className="flex flex-wrap gap-3">
                    {item.source === 'user' && (
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link to={`/foods/${item.id}/edit`}>Edit</Link>
                      </Button>
                    )}
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link to={`/foods/log?foodId=${item.id}&date=${today}`}>Log today</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
