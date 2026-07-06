import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Food } from '@calorie-tracker/shared';
import { Input } from '@/components/ui/input';
import { cn, inputFieldClass } from '@/lib/utils';

export function formatFoodLabel(food: Food): string {
  return food.brand ? `${food.brand} - ${food.name}` : food.name;
}

type FoodPickerProps = {
  id?: string;
  foods: Food[];
  value: string;
  onChange: (foodId: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function FoodPicker({
  id,
  foods,
  value,
  onChange,
  placeholder = 'Search foods…',
  disabled,
}: FoodPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = foods.find((food) => food.id === value);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return foods;
    return foods.filter((food) => formatFoodLabel(food).toLowerCase().includes(normalized));
  }, [foods, query]);

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

  const selectFood = (food: Food) => {
    onChange(food.id);
    setQuery('');
    setOpen(false);
  };

  const displayValue = open ? query : selected ? formatFoodLabel(selected) : query;

  return (
    <div ref={rootRef} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        className={cn(inputFieldClass, 'mb-0')}
        placeholder={placeholder}
        value={displayValue}
        onFocus={(event) => {
          setOpen(true);
          if (selected) {
            setQuery(formatFoodLabel(selected));
            event.currentTarget.select();
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (value) onChange('');
        }}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
            setOpen(true);
            return;
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === 'Enter' && open && filtered[activeIndex]) {
            event.preventDefault();
            selectFood(filtered[activeIndex]);
          } else if (event.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
        }}
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No foods found</li>
          ) : (
            filtered.map((food, index) => (
              <li
                key={food.id}
                role="option"
                aria-selected={food.id === value}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm',
                  index === activeIndex && 'bg-accent text-accent-foreground',
                  food.id === value && index !== activeIndex && 'font-medium',
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectFood(food)}
              >
                {formatFoodLabel(food)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
