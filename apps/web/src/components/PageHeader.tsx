import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HeaderActions } from './HeaderActions';

export function PageHeader({
  title,
  backTo,
  embedded = false,
}: {
  title: string;
  backTo?: string;
  embedded?: boolean;
}) {
  return (
    <header
      className={cn(
        'border-b border-border bg-header-surface backdrop-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]',
        !embedded && 'sticky top-0 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.35)]',
      )}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3">
        {backTo && (
          <Button variant="link" className="h-auto shrink-0 p-0" asChild>
            <Link to={backTo}>← Back</Link>
          </Button>
        )}
        <h1 className="min-w-0 truncate text-lg font-bold">{title}</h1>
        <div className="ml-auto shrink-0">
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}