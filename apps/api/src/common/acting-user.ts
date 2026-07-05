import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { users, type DbClient } from '@calorie-tracker/db';
import type { AuthUser } from '../auth/jwt-auth.guard';

export async function resolveActingUserId(
  db: DbClient,
  user: AuthUser,
  forUserId?: string,
): Promise<string> {
  if (!forUserId || forUserId === user.userId) {
    return user.userId;
  }

  if (user.role !== 'admin') {
    throw new ForbiddenException('Admin access required');
  }

  const client = await db.query.users.findFirst({
    where: and(eq(users.id, forUserId), eq(users.role, 'client')),
  });
  if (!client) {
    throw new NotFoundException('Client user not found');
  }

  return forUserId;
}
