import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Exercise } from '@calorie-tracker/shared';
import { Input } from '@/components/ui/input';
import { cn, inputFieldClass } from '@/lib/utils';

type ExercisePickerProps = {
  id?: string;
  exercises: Exercise[];
  value: string;
  onChange: (exerciseId: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function ExercisePicker({
  id,
  exercises,
  value,
  onChange,
  placeholder = 'Search exercises…',
  disabled,
}: ExercisePickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = exercises.find((ex) => ex.id === value);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return exercises;
    return exercises.filter((ex) => ex.name.toLowerCase().includes(normalized));
  }, [exercises, query]);

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

  return (
    <div ref={rootRef} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        placeholder={selected && !open ? selected.name : placeholder}
        value={open ? query : selected && !query ? selected.name : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && filtered[activeIndex]) {
            e.preventDefault();
            onChange(filtered[activeIndex].id);
            setOpen(false);
            setQuery('');
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={cn(inputFieldClass)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
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
        </ul>
      )}
    </div>
  );
}
