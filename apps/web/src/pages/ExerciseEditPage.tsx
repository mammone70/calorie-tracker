import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/client';
import type { Exercise } from '@calorie-tracker/shared';
import { cn, inputFieldClass } from '@/lib/utils';

export function ExerciseEditPage() {
  const { isAdmin } = useAuth();
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.getExercises() as Promise<Exercise[]>,
  });

  const exercise = data?.find((ex) => ex.id === exerciseId);
  const canEdit = exercise ? !exercise.isGlobal || isAdmin : false;

  useEffect(() => {
    if (!exercise) return;
    setName(exercise.name);
    setNotes(exercise.notes ?? '');
    setIsGlobal(exercise.isGlobal);
  }, [exercise]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exerciseId || !canEdit) return;
    setSaving(true);
    setError('');
    try {
      await api.updateExercise(exerciseId, {
        name: name.trim(),
        notes: notes.trim() || null,
        ...(isAdmin ? { isGlobal } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
      navigate('/exercises');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update exercise');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!exerciseId || !canEdit || !confirm('Delete this exercise?')) return;
    try {
      await api.deleteExercise(exerciseId);
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
      navigate('/exercises');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Edit exercise" backTo="/exercises" />
        <p className="p-4 text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div>
        <PageHeader title="Edit exercise" backTo="/exercises" />
        <p className="p-4 text-muted-foreground">Exercise not found.</p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div>
        <PageHeader title="Edit exercise" backTo="/exercises" />
        <p className="p-4 text-muted-foreground">
          This is a global exercise. Only admins can edit it.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Edit exercise" backTo="/exercises" />
      <form onSubmit={onSubmit} className="mx-auto w-full max-w-lg space-y-4 px-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="ex-name">Name</Label>
          <Input
            id="ex-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(inputFieldClass)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ex-notes">Notes (optional)</Label>
          <textarea
            id="ex-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cn(inputFieldClass, 'min-h-24')}
          />
        </div>
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isGlobal}
              onChange={(e) => setIsGlobal(e.target.checked)}
            />
            Global (available to all users)
          </label>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="destructive" className="w-full" onClick={() => void onDelete()}>
          Delete
        </Button>
        <Button variant="outline" className="w-full" asChild>
          <Link to="/exercises">Cancel</Link>
        </Button>
      </form>
    </div>
  );
}
