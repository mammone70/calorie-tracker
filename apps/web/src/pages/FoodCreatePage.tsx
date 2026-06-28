import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { macroCaloriesError } from '@calorie-tracker/shared';
import { MacroCaloriesFeedback, MacroCaloriesInput } from '../components/MacroCaloriesFeedback';
import { PageHeader } from '../components/PageHeader';
import { useMacroCaloriesValidation } from '../hooks/useMacroCaloriesValidation';
import { api, localStore } from '../lib/client';
import { todayDateString } from '@calorie-tracker/client';

export function FoodCreatePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);

  const macroValidation = useMacroCaloriesValidation({ calories, protein, fat, carbs });
  const macroFieldsInvalid = macroValidation.show && !macroValidation.isValid;

  const handleSave = async () => {
    if (!name) {
      setMessage('Food name is required');
      setMessageIsError(true);
      return;
    }

    const nutrientsPer100g = {
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      carbs: Number(carbs) || 0,
    };

    const validationError = macroCaloriesError(
      nutrientsPer100g.calories,
      nutrientsPer100g.protein,
      nutrientsPer100g.fat,
      nutrientsPer100g.carbs,
    );
    if (validationError) {
      setMessage(validationError);
      setMessageIsError(true);
      return;
    }

    setMessage('');
    setMessageIsError(false);
    try {
      const userId = api.getUserId();
      let foodId: string;

      if (userId) {
        const food = await localStore.localCreateFood(userId, {
          name,
          brand: brand || undefined,
          source: 'user',
          nutrientsPer100g,
        });
        foodId = food.id;
      } else {
        const food = (await api.createFood({
          name,
          brand: brand || undefined,
          source: 'user',
          nutrientsPer100g,
        })) as { id: string };
        foodId = food.id;
      }

      await queryClient.invalidateQueries({ queryKey: ['foods'] });

      setMessage('Food saved — choose a meal to log it');
      setMessageIsError(false);
      setTimeout(
        () => navigate(`/foods/log?foodId=${foodId}&date=${todayDateString()}`),
        800,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save');
      setMessageIsError(true);
    }
  };

  return (
    <div>
      <PageHeader title="Add Food" backTo="/foods" />
      <div className="mx-auto max-w-lg px-4 pb-8">
        <p className="my-4 text-muted">
          Enter nutrition values per 100g. Calories should equal protein×4 + carbs×4 + fat×9.
        </p>
        {message && (
          <p className={`mb-4 text-sm ${messageIsError ? 'text-danger' : 'text-primary'}`}>
            {message}
          </p>
        )}

        <input
          className="input-field"
          placeholder="Food name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input-field"
          placeholder="Brand (optional)"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <MacroCaloriesInput
          value={calories}
          onChange={setCalories}
          placeholder="Calories"
          invalid={macroFieldsInvalid}
          className="mb-2"
        />
        <MacroCaloriesInput
          value={protein}
          onChange={setProtein}
          placeholder="Protein (g)"
          invalid={macroFieldsInvalid}
          className="mb-2"
        />
        <MacroCaloriesInput
          value={fat}
          onChange={setFat}
          placeholder="Fat (g)"
          invalid={macroFieldsInvalid}
          className="mb-2"
        />
        <MacroCaloriesInput
          value={carbs}
          onChange={setCarbs}
          placeholder="Carbs (g)"
          invalid={macroFieldsInvalid}
          className="mb-2"
        />
        <MacroCaloriesFeedback validation={macroValidation} className="mb-3" />

        <button
          type="button"
          className="btn-primary mt-2 w-full"
          onClick={handleSave}
          disabled={macroFieldsInvalid}
        >
          Save food
        </button>
      </div>
    </div>
  );
}
