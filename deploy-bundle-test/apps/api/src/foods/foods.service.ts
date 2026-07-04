import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { foods, type DbClient } from '@calorie-tracker/db';
import type { CreateFoodInput, UpdateFoodInput } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { serializeFood } from '../common/serializers';

@Injectable()
export class FoodsService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async findAll(userId: string) {
    const rows = await this.db.query.foods.findMany({
      where: and(eq(foods.userId, userId), isNull(foods.deletedAt)),
    });
    return rows.map(serializeFood);
  }

  async findOne(userId: string, id: string) {
    const row = await this.db.query.foods.findFirst({
      where: and(eq(foods.id, id), eq(foods.userId, userId), isNull(foods.deletedAt)),
    });
    if (!row) throw new NotFoundException('Food not found');
    return serializeFood(row);
  }

  async create(userId: string, input: CreateFoodInput, id?: string) {
    const [row] = await this.db
      .insert(foods)
      .values({
        ...(id ? { id } : {}),
        userId,
        name: input.name,
        brand: input.brand,
        source: input.source,
        externalId: input.externalId,
        nutrientsPer100g: input.nutrientsPer100g,
        servingSizes: input.servingSizes ?? null,
      })
      .returning();
    return serializeFood(row);
  }

  async update(userId: string, id: string, input: UpdateFoodInput) {
    const existing = await this.db.query.foods.findFirst({
      where: and(eq(foods.id, id), eq(foods.userId, userId), isNull(foods.deletedAt)),
    });
    if (!existing) throw new NotFoundException('Food not found');

    const [row] = await this.db
      .update(foods)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.brand !== undefined && { brand: input.brand }),
        ...(input.source !== undefined && { source: input.source }),
        ...(input.externalId !== undefined && { externalId: input.externalId }),
        ...(input.nutrientsPer100g !== undefined && {
          nutrientsPer100g: input.nutrientsPer100g,
        }),
        ...(input.servingSizes !== undefined && { servingSizes: input.servingSizes }),
        updatedAt: new Date(),
      })
      .where(eq(foods.id, id))
      .returning();
    return serializeFood(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.query.foods.findFirst({
      where: and(eq(foods.id, id), eq(foods.userId, userId)),
    });
    if (!existing) throw new NotFoundException('Food not found');

    const [row] = await this.db
      .update(foods)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(foods.id, id))
      .returning();
    return serializeFood(row);
  }

  async findByExternalId(userId: string, source: string, externalId: string) {
    const row = await this.db.query.foods.findFirst({
      where: and(
        eq(foods.userId, userId),
        eq(foods.source, source as 'usda' | 'open_food_facts' | 'user'),
        eq(foods.externalId, externalId),
        isNull(foods.deletedAt),
      ),
    });
    return row ? serializeFood(row) : null;
  }
}
