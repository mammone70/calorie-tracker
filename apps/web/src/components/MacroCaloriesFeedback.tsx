import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { MacroCaloriesValidation } from '../hooks/useMacroCaloriesValidation';

type MacroCaloriesFeedbackProps = {
  validation: MacroCaloriesValidation;
  className?: string;
};

export function MacroCaloriesFeedback({ validation, className = '' }: MacroCaloriesFeedbackProps) {
  if (!validation.show) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'text-sm',
        validation.isValid ? 'text-primary' : 'text-destructive',
        className,
      )}
    >
      {validation.message}
    </p>
  );
}

type MacroCaloriesInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
  id?: string;
  invalid?: boolean;
  className?: string;
};

export function MacroCaloriesInput({
  value,
  onChange,
  placeholder,
  label,
  id,
  invalid = false,
  className = '',
}: MacroCaloriesInputProps) {
  const input = (
    <Input
      id={id}
      className={cn('mb-0', className)}
      placeholder={placeholder}
      inputMode="decimal"
      value={value}
      aria-invalid={invalid}
      onChange={(e) => onChange(e.target.value)}
    />
  );

  if (!label) return input;

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {input}
    </div>
  );
}
