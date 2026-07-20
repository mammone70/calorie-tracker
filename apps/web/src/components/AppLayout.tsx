import { Home, CalendarDays, UtensilsCrossed, Settings, Dumbbell } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HeaderActions } from './HeaderActions';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', label: 'Today', end: true, icon: Home },
  { to: '/calendar', label: 'Calendar', end: false, icon: CalendarDays },
  { to: '/workouts', label: 'Lift', end: false, icon: Dumbbell },
  { to: '/foods', label: 'Foods', end: false, icon: UtensilsCrossed },
  { to: '/settings', label: 'Settings', end: false, icon: Settings },
] as const;

export function AppLayout() {
  const { isOnline } = useAuth();
  const { pathname } = useLocation();
  const isTodayTab = pathname === '/';
  const showBrandHeader =
    !isTodayTab &&
    (pathname === '/calendar' ||
      pathname === '/workouts' ||
      pathname === '/foods' ||
      pathname === '/settings' ||
      pathname.startsWith('/exercises') ||
      pathname.startsWith('/workouts') ||
      pathname.startsWith('/weekly-') ||
      pathname.startsWith('/day/'));

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {!isOnline && (
        <div className="bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
          Offline — changes will sync when back online
        </div>
      )}
      {showBrandHeader && (
        <header className="sticky top-0 z-30 border-b border-border/60 bg-app py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div
            className={cn(
              'mx-auto flex w-full min-w-0 items-center justify-between gap-3 px-4',
              pathname.startsWith('/workouts') || pathname.startsWith('/exercises')
                ? 'max-w-[1400px]'
                : 'max-w-lg',
            )}
          >
            <h1 className="truncate text-lg font-bold text-primary">Fitty Kitties</h1>
            <HeaderActions />
          </div>
        </header>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-app bg-app-bottom pb-safe">
        <div className="flex w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => {
                  const active =
                    isActive ||
                    (tab.to === '/calendar' && pathname.startsWith('/day/')) ||
                    (tab.to === '/workouts' &&
                      (pathname.startsWith('/workouts') || pathname.startsWith('/exercises')));
                  return cn(
                    'flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.65rem] font-medium transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground',
                  );
                }}
              >
                <Icon className="size-5" strokeWidth={2} aria-hidden />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
