import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/client';
import { cn, inputFieldClass } from '@/lib/utils';

export function ExerciseCreatePage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isGlobal, setIsGlobal] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createExercise({
        name: name.trim(),
        notes: notes.trim() || null,
        isGlobal: isAdmin ? isGlobal : true,
      });
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
      navigate('/exercises');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create exercise');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="New exercise" backTo="/exercises" />
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
        <Button variant="outline" className="w-full" asChild>
          <Link to="/exercises">Cancel</Link>
        </Button>
      </form>
    </div>
  );
}
