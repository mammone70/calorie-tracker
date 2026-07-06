import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

export function HeaderActions() {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <ThemeToggle />
      <UserMenu />
    </div>
  );
}
