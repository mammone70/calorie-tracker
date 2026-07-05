import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/client';
import { WeeklyTargetsPage } from './WeeklyTargetsPage';
import type { AdminUser } from '@calorie-tracker/shared';

export function AdminClientTargetsPage() {
  const { userId } = useParams<{ userId: string }>();
  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.listUsers() as Promise<AdminUser[]>,
  });

  const client = usersQuery.data?.find((user) => user.id === userId);
  const title = client ? `${client.email} — Targets` : 'Client Targets';

  if (!userId) return null;

  return (
    <WeeklyTargetsPage forUserId={userId} backTo="/admin" title={title} />
  );
}
