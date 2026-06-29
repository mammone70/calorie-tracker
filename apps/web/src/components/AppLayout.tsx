import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', label: 'Today', end: true },
  { to: '/calendar', label: 'Calendar' },
  { to: '/foods', label: 'Foods' },
  { to: '/settings', label: 'Settings' },
];

export function AppLayout() {
  const { isOnline } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] pt-safe-top">
      {!isOnline && (
        <div className="bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
          Offline — changes will sync when back online
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-border bg-background px-4 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.35)] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <h1 className="truncate text-lg font-bold text-primary">Calorie Tracker</h1>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background pb-safe shadow-[0_-6px_24px_rgba(0,0,0,0.5)]">
        <div className="mx-auto flex max-w-lg">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center py-3 text-xs font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
