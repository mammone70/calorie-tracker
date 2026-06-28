import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { localGetMacroTargets, localGetFoods, localGetFoodLogs } from './local-store';

export function useMacroTargets(from: string, to: string) {
  return useQuery({
    queryKey: ['macro-targets', from, to],
    queryFn: async () => {
      try {
        return (await api.getMacroTargets(from, to)) as Array<Record<string, unknown>>;
      } catch {
        const userId = api.getUserId();
        if (!userId) return [];
        const local = await localGetMacroTargets(userId, from, to);
        return local.map((row) => ({
          id: row.id,
          userId: row.userId,
          targetDate: row.targetDate,
          calories: row.calories,
          proteinG: row.proteinG,
          fatG: row.fatG,
          carbsG: row.carbsG,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }));
      }
    },
  });
}

export function useFoods() {
  return useQuery({
    queryKey: ['foods'],
    queryFn: async () => {
      try {
        return (await api.getFoods()) as Array<Record<string, unknown>>;
      } catch {
        const userId = api.getUserId();
        if (!userId) return [];
        return localGetFoods(userId);
      }
    },
  });
}

export function useFoodLogs(date: string) {
  return useQuery({
    queryKey: ['food-logs', date],
    queryFn: async () => {
      try {
        return (await api.getFoodLogs(date)) as Array<Record<string, unknown>>;
      } catch {
        const userId = api.getUserId();
        if (!userId) return [];
        return localGetFoodLogs(userId, date);
      }
    },
  });
}
