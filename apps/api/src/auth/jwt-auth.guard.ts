import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { UserRole } from '@calorie-tracker/shared';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

export type AuthUser = {
  userId: string;
  email: string;
  role: UserRole;
};
