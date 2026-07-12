import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/client';
import type { Exercise } from '@calorie-tracker/shared';
import { cn, inputFieldClass } from '@/lib/utils';

export function ExercisesPage() {
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.getExercises() as Promise<Exercise[]>,
  });

  const exercises = data ?? [];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return exercises;
    return exercises.filter(
      (ex) =>
        ex.name.toLowerCase().includes(normalized) ||
        (ex.notes ?? '').toLowerCase().includes(normalized),
    );
  }, [exercises, query]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-lg px-4 pb-4">
      <div className="space-y-2 py-4">
        <Input
          type="search"
          role="searchbox"
          aria-label="Search exercises"
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={cn(inputFieldClass, 'mb-0')}
          autoComplete="off"
        />
        <Button className="w-full" size="lg" asChild>
          <Link to="/exercises/new">+ Add exercise</Link>
        </Button>
        <Button variant="outline" className="w-full" size="lg" asChild>
          <Link to="/workouts">Workout templates</Link>
        </Button>
        <Button variant="link" className="w-full" onClick={() => void refetch()}>
          Refresh list
        </Button>
      </div>

      {exercises.length === 0 ? (
        <p className="px-2 text-center text-muted-foreground">
          {isLoading ? 'Loading…' : 'No exercises yet. Add your first lift.'}
        </p>
      ) : filtered.length === 0 ? (
        <p className="px-2 text-center text-muted-foreground">No exercises match “{query.trim()}”.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => {
            const canEdit = !item.isGlobal || isAdmin;
            return (
              <li key={item.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <span>{item.name}</span>
                      {item.isGlobal && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                          Global
                        </span>
                      )}
                    </CardTitle>
                    {item.notes && (
                      <CardDescription className="line-clamp-2">{item.notes}</CardDescription>
                    )}
                  </CardHeader>
                  {canEdit && (
                    <CardContent>
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link to={`/exercises/${item.id}/edit`}>Edit</Link>
                      </Button>
                    </CardContent>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
