import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { Food } from '@calorie-tracker/shared';
import { FoodForm, type FoodFormValues } from '../components/FoodForm';
import { PageHeader } from '../components/PageHeader';
import { api, localStore } from '../lib/client';
import { showSuccess } from '@/lib/toast';

export function FoodEditPage() {
  const { foodId } = useParams<{ foodId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const foodQuery = useQuery({
    queryKey: ['food', foodId],
    enabled: !!foodId,
    queryFn: async () => {
      const userId = api.getUserId();
      if (userId) {
        const foods = await localStore.localGetFoods(userId);
        const food = foods.find((item) => item.id === foodId);
        if (!food) throw new Error('Food not found');
        return food as Food;
      }
      return api.getFood(foodId!) as Promise<Food>;
    },
  });

  if (!foodId) {
    return <Navigate to="/foods" replace />;
  }

  if (foodQuery.isLoading) {
    return (
      <div>
        <PageHeader title="Edit Food" backTo="/foods" />
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (foodQuery.isError || !foodQuery.data) {
    return (
      <div>
        <PageHeader title="Edit Food" backTo="/foods" />
        <p className="px-4 py-6 text-sm text-destructive">Food not found.</p>
      </div>
    );
  }

  const food = foodQuery.data;

  if (food.source !== 'user') {
    return <Navigate to="/foods" replace />;
  }

  const handleSubmit = async (values: FoodFormValues) => {
    const userId = api.getUserId();
    const payload = {
      name: values.name,
      brand: values.brand ?? '',
      nutrientsPer100g: values.nutrientsPer100g,
      servingSizes: values.servingSizes,
    };

    if (userId) {
      await localStore.localUpdateFood(userId, food.id, payload);
    } else {
      await api.updateFood(food.id, payload);
    }

    await queryClient.invalidateQueries({ queryKey: ['foods'] });
    await queryClient.invalidateQueries({ queryKey: ['food', food.id] });
    showSuccess('Food updated');
    navigate('/foods');
  };

  return (
    <div>
      <PageHeader title="Edit Food" backTo="/foods" />
      <div className="mx-auto w-full min-w-0 max-w-lg px-4 pb-8 pt-4">
        <FoodForm
          key={food.id}
          initial={{
            name: food.name,
            brand: food.brand ?? '',
            nutrientsPer100g: food.nutrientsPer100g,
            servingSizes: food.servingSizes ?? [],
          }}
          submitLabel="Save changes"
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
