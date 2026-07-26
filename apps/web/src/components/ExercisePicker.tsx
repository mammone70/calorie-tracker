import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Exercise } from '@calorie-tracker/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, inputFieldClass } from '@/lib/utils';

type ExercisePickerProps = {
  id?: string;
  exercises: Exercise[];
  value: string;
  onChange: (exerciseId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** When provided, shows a create action for the current search query. */
  onCreateExercise?: (name: string) => Promise<Exercise>;
};

export function ExercisePicker({
  id,
  exercises,
  value,
  onChange,
  placeholder = 'Search exercises…',
  disabled,
  onCreateExercise,
}: ExercisePickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const selected = exercises.find((ex) => ex.id === value);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return exercises;
    return exercises.filter((ex) => ex.name.toLowerCase().includes(normalized));
  }, [exercises, query]);

  const trimmedQuery = query.trim();
  const exactMatch = exercises.some(
    (ex) => ex.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const canCreate =
    !!onCreateExercise && trimmedQuery.length > 0 && !exactMatch && !disabled;

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        if (selected) setQuery('');
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [selected]);

  const createExercise = async () => {
    if (!onCreateExercise || !canCreate) return;
    setCreating(true);
    setCreateError('');
    try {
      const created = await onCreateExercise(trimmedQuery);
      onChange(created.id);
      setOpen(false);
      setQuery('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create exercise');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled || creating}
        placeholder={selected && !open ? selected.name : placeholder}
        value={open ? query : selected && !query ? selected.name : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setCreateError('');
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setCreateError('');
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[activeIndex]) {
              onChange(filtered[activeIndex].id);
              setOpen(false);
              setQuery('');
            } else if (canCreate) {
              void createExercise();
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={cn(inputFieldClass)}
        autoComplete="off"
      />
      {open && (filtered.length > 0 || canCreate) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md"
        >
          {filtered.map((ex, index) => (
            <li key={ex.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  'flex w-full px-3 py-2 text-left text-sm hover:bg-accent',
                  index === activeIndex && 'bg-accent',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(ex.id);
                  setOpen(false);
                  setQuery('');
                }}
              >
                {ex.name}
              </button>
            </li>
          ))}
          {canCreate && (
            <li className="border-t border-border px-2 py-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start px-2 py-1.5 text-left text-sm"
                disabled={creating}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void createExercise()}
              >
                {creating ? 'Creating…' : `Create “${trimmedQuery}”`}
              </Button>
            </li>
          )}
        </ul>
      )}
      {createError && <p className="mt-1 text-xs text-destructive">{createError}</p>}
    </div>
  );
}
