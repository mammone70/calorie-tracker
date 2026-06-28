import { Link } from 'react-router-dom';

export function PageHeader({ title, backTo }: { title: string; backTo?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border-light bg-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        {backTo && (
          <Link to={backTo} className="text-primary">
            ← Back
          </Link>
        )}
        <h1 className="text-lg font-bold">{title}</h1>
      </div>
    </header>
  );
}
