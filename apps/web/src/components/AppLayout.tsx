import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
        <div className="bg-primary-dark px-4 py-2 text-center text-sm text-white">
          Offline — changes will sync when back online
        </div>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 border-t border-border-light bg-surface pb-safe">
        <div className="mx-auto flex max-w-lg">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center py-3 text-xs font-medium transition ${
                  isActive ? 'text-primary' : 'text-muted'
                }`
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
