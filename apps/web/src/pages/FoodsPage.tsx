import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/client';
import { todayDateString } from '@calorie-tracker/client';
import { formatNutrientsSummary, type Food } from '@calorie-tracker/shared';

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
    <div className="mx-auto w-full min-w-0 max-w-lg px-4 pb-4">
      <div className="space-y-2 p-4">
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

      {(data ?? []).length === 0 ? (
        <p className="px-6 text-center text-muted-foreground">
          {isLoading ? 'Loading…' : 'No saved foods yet. Search or add manually.'}
        </p>
      ) : (
        <ul className="space-y-2 px-4">
          {(data ?? []).map((item) => (
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
                  <p className="text-xs capitalize text-muted-foreground">{item.source}</p>
                  <Button variant="link" className="h-auto p-0" asChild>
                    <Link to={`/foods/log?foodId=${item.id}&date=${today}`}>Log today</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
