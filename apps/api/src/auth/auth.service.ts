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

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly invitationsService: InvitationsService,
  ) {}

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

    const tokens = await this.issueTokens(user);
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

    const tokens = await this.issueTokens(user);
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
    return this.issueTokens(user);
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

  private async issueTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: getJwtAccessSecret(),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: getJwtRefreshSecret(),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d',
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
