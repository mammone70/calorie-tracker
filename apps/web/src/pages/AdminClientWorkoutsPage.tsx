import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/client';
import { WorkoutsPage } from './WorkoutsPage';
import type { AdminUser } from '@calorie-tracker/shared';

export function AdminClientWorkoutsPage() {
  const { userId } = useParams<{ userId: string }>();
  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.listUsers() as Promise<AdminUser[]>,
  });

  const client = usersQuery.data?.find((user) => user.id === userId);
  const title = client ? `${client.email} — Workouts` : 'Client Workouts';

  if (!userId) return null;

  return <WorkoutsPage forUserId={userId} backTo="/admin" title={title} />;
}
