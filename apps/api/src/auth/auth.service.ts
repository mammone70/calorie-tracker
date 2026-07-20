import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { users, refreshTokens, type DbClient, type User } from '@calorie-tracker/db';
import type { ChangePasswordInput, LoginInput, RegisterInput } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { getJwtAccessSecret, getJwtRefreshSecret } from '../config/env.validation';
import { toIso } from '../common/serializers';
import { InvitationsService } from '../invitations/invitations.service';

type IssueTokenOptions = {
  trusted?: boolean;
};

/** Parse durations like 15m, 1h, 30d into a future Date. */
export function expiresAtFromDuration(duration: string, from = new Date()): Date {
  const match = /^(\d+)\s*([smhd])$/i.exec(duration.trim());
  const result = new Date(from);
  if (!match) {
    result.setDate(result.getDate() + 30);
    return result;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 's') result.setSeconds(result.getSeconds() + amount);
  else if (unit === 'm') result.setMinutes(result.getMinutes() + amount);
  else if (unit === 'h') result.setHours(result.getHours() + amount);
  else result.setDate(result.getDate() + amount);
  return result;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly invitationsService: InvitationsService,
  ) {}

  private accessExpiresIn(trusted: boolean) {
    if (trusted) {
      return this.config.get<string>('JWT_TRUSTED_ACCESS_EXPIRES_IN') ?? '1h';
    }
    return this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
  }

  private refreshExpiresIn(trusted: boolean) {
    if (trusted) {
      return this.config.get<string>('JWT_TRUSTED_REFRESH_EXPIRES_IN') ?? '90d';
    }
    return this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
  }

  async register(input: RegisterInput, allowWithoutInvite = false) {
    if (input.inviteToken) {
      await this.invitationsService.consumeInvite(input.inviteToken, input.email);
    } else if (!allowWithoutInvite) {
      throw new UnauthorizedException('Registration requires a valid invitation');
    }

    const existing = await this.db.query.users.findFirst({
      where: eq(users.email, input.email.toLowerCase()),
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const [user] = await this.db
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        passwordHash,
        role: 'client',
      })
      .returning();

    const tokens = await this.issueTokens(user, { trusted: input.trustedDevice !== false });
    return {
      user: this.serializeUser(user),
      ...tokens,
    };
  }

  async login(input: LoginInput) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, input.email.toLowerCase()),
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user, { trusted: input.trustedDevice !== false });
    return {
      user: this.serializeUser(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; email: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: getJwtRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
    return this.issueTokens(user, { trusted: stored.trusted });
  }

  async getMe(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.serializeUser(user);
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await this.db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }

  serializeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      weightUnit: user.weightUnit ?? 'lbs',
      createdAt: toIso(user.createdAt)!,
    };
  }

  async updatePreferences(userId: string, input: { weightUnit: 'lbs' | 'kg' }) {
    const [row] = await this.db
      .update(users)
      .set({ weightUnit: input.weightUnit, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!row) {
      throw new UnauthorizedException('User not found');
    }
    return this.serializeUser(row);
  }

  private async issueTokens(user: User, options: IssueTokenOptions = {}) {
    const trusted = options.trusted === true;
    const accessExpiresIn = this.accessExpiresIn(trusted);
    const refreshExpiresIn = this.refreshExpiresIn(trusted);

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: getJwtAccessSecret(),
      expiresIn: accessExpiresIn,
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: getJwtRefreshSecret(),
      expiresIn: refreshExpiresIn,
    });

    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      trusted,
      expiresAt: expiresAtFromDuration(refreshExpiresIn),
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
