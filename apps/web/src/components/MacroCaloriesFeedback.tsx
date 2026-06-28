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
      className={`text-sm ${validation.isValid ? 'text-primary' : 'text-danger'} ${className}`}
    >
      {validation.message}
    </p>
  );
}

type MacroCaloriesInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  invalid?: boolean;
  className?: string;
};

export function MacroCaloriesInput({
  value,
  onChange,
  placeholder,
  invalid = false,
  className = '',
}: MacroCaloriesInputProps) {
  return (
    <input
      className={`input-field mb-0 ${invalid ? 'border-danger focus:border-danger focus:ring-danger' : ''} ${className}`}
      placeholder={placeholder}
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
