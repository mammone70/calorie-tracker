import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HeaderActions } from './HeaderActions';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', label: 'Today', end: true },
  { to: '/calendar', label: 'Calendar' },
  { to: '/foods', label: 'Foods' },
  { to: '/settings', label: 'Settings' },
];

const mainTabPaths = new Set(tabs.map((tab) => tab.to));

export function AppLayout() {
  const { isOnline } = useAuth();
  const { pathname } = useLocation();
  const showAppHeader = mainTabPaths.has(pathname);

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] pt-safe-top">
      {!isOnline && (
        <div className="bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
          Offline — changes will sync when back online
        </div>
      )}
      {showAppHeader && (
        <header className="sticky top-0 z-30 border-b border-border bg-header-surface backdrop-surface px-4 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.35)] pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <h1 className="truncate text-lg font-bold text-primary">Fitty Kitties</h1>
            <HeaderActions />
          </div>
        </header>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-header-surface backdrop-surface pb-safe shadow-[0_-6px_24px_rgba(0,0,0,0.5)]">
        <div className="mx-auto flex max-w-lg">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => {
                const active =
                  isActive || (tab.to === '/calendar' && pathname.startsWith('/day/'));
                return cn(
                  'flex flex-1 flex-col items-center py-3 text-xs font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                );
              }}
            >
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
