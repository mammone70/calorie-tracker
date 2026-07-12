import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FoodForm, type FoodFormValues } from '../components/FoodForm';
import { PageHeader } from '../components/PageHeader';
import { api, localStore } from '../lib/client';
import { todayDateString } from '@calorie-tracker/client';

export function FoodCreatePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleSubmit = async (values: FoodFormValues) => {
    const userId = api.getUserId();
    let foodId: string;

    if (userId) {
      const food = await localStore.localCreateFood(userId, {
        name: values.name,
        brand: values.brand,
        source: 'user',
        nutrientsPer100g: values.nutrientsPer100g,
        servingSizes: values.servingSizes.length > 0 ? values.servingSizes : undefined,
      });
      foodId = food.id;
    } else {
      const food = (await api.createFood({
        name: values.name,
        brand: values.brand,
        source: 'user',
        nutrientsPer100g: values.nutrientsPer100g,
        servingSizes: values.servingSizes.length > 0 ? values.servingSizes : undefined,
      })) as { id: string };
      foodId = food.id;
    }

    await queryClient.invalidateQueries({ queryKey: ['foods'] });
    navigate(`/foods/log?foodId=${foodId}&date=${todayDateString()}`);
  };

  return (
    <div>
      <PageHeader title="Add Food" backTo="/foods" />
      <div className="mx-auto w-full min-w-0 max-w-lg px-4 pb-8 pt-4">
        <FoodForm submitLabel="Save food" onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
