import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '../contexts/ThemeContext';

export function ThemeToggle({ className }: { className?: string }) {
  const { colorMode, setColorMode } = useTheme();
  const isDark = colorMode === 'dark';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-8 text-muted-foreground', className)}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setColorMode(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
