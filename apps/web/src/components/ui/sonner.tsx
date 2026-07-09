import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';

export function Toaster() {
  const { colorMode } = useTheme();

  return (
    <Sonner
      theme={colorMode}
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'group toast border-border bg-popover text-popover-foreground shadow-lg',
          title: 'text-sm font-medium',
          description: 'text-sm text-muted-foreground',
        },
      }}
    />
  );
}
