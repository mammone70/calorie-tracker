import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/client';
import { WeeklyMealPlansPage } from './WeeklyMealPlansPage';
import type { AdminUser } from '@calorie-tracker/shared';

export function AdminClientMealPlansPage() {
  const { userId } = useParams<{ userId: string }>();
  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.listUsers() as Promise<AdminUser[]>,
  });

  const client = usersQuery.data?.find((user) => user.id === userId);
  const title = client ? `${client.email} — Meal Plans` : 'Client Meal Plans';

  if (!userId) return null;

  return (
    <WeeklyMealPlansPage
      forUserId={userId}
      backTo="/admin"
      title={title}
      targetsLink={`/admin/clients/${userId}/targets`}
    />
  );
}
