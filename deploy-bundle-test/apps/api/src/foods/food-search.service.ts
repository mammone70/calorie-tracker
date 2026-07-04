import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FoodSearchResult, Nutrients } from '@calorie-tracker/shared';

type UsdaFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  foodNutrients?: Array<{
    nutrientName: string;
    value: number;
  }>;
};

type OffProduct = {
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number | undefined>;
  code?: string;
};

@Injectable()
export class FoodSearchService {
  constructor(private readonly config: ConfigService) {}

  async search(query: string, limit = 20): Promise<FoodSearchResult[]> {
    const [usda, off] = await Promise.all([
      this.searchUsda(query, Math.ceil(limit / 2)),
      this.searchOpenFoodFacts(query, Math.ceil(limit / 2)),
    ]);

    const combined = [...usda, ...off];
    const seen = new Set<string>();
    const deduped: FoodSearchResult[] = [];

    for (const item of combined) {
      const key = `${item.source}:${item.externalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= limit) break;
    }

    return deduped;
  }

  private async searchUsda(query: string, limit: number): Promise<FoodSearchResult[]> {
    const apiKey = this.config.get<string>('USDA_API_KEY');
    if (!apiKey || apiKey === 'your-usda-api-key-here') {
      return [];
    }

    try {
      const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('query', query);
      url.searchParams.set('pageSize', String(limit));
      url.searchParams.set('dataType', 'Foundation,SR Legacy,Survey (FNDDS)');

      const res = await fetch(url.toString());
      if (!res.ok) return [];

      const data = (await res.json()) as { foods?: UsdaFood[] };
      return (data.foods ?? []).map((food) => ({
        externalId: String(food.fdcId),
        source: 'usda' as const,
        name: food.description,
        brand: food.brandOwner,
        nutrientsPer100g: this.extractUsdaNutrients(food),
      }));
    } catch {
      return [];
    }
  }

  private extractUsdaNutrients(food: UsdaFood): Nutrients {
    const nutrients = food.foodNutrients ?? [];
    const find = (name: string) =>
      nutrients.find((n) => n.nutrientName.toLowerCase().includes(name.toLowerCase()))
        ?.value ?? 0;

    return {
      calories: find('energy') || find('calories'),
      protein: find('protein'),
      fat: find('total lipid') || find('fat'),
      carbs: find('carbohydrate'),
    };
  }

  private async searchOpenFoodFacts(
    query: string,
    limit: number,
  ): Promise<FoodSearchResult[]> {
    try {
      const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
      url.searchParams.set('search_terms', query);
      url.searchParams.set('search_simple', '1');
      url.searchParams.set('action', 'process');
      url.searchParams.set('json', '1');
      url.searchParams.set('page_size', String(limit));

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'CalorieTracker/0.1 (personal use)' },
      });
      if (!res.ok) return [];

      const data = (await res.json()) as { products?: OffProduct[] };
      return (data.products ?? [])
        .filter((p) => p.product_name)
        .map((product) => ({
          externalId: product.code ?? product.product_name!,
          source: 'open_food_facts' as const,
          name: product.product_name!,
          brand: product.brands,
          nutrientsPer100g: this.extractOffNutrients(product),
        }));
    } catch {
      return [];
    }
  }

  private extractOffNutrients(product: OffProduct): Nutrients {
    const n = product.nutriments ?? {};
    return {
      calories: n['energy-kcal_100g'] ?? n['energy_100g'] ?? 0,
      protein: n.proteins_100g ?? 0,
      fat: n.fat_100g ?? 0,
      carbs: n.carbohydrates_100g ?? 0,
    };
  }
}
