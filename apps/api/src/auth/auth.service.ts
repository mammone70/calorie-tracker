import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { users, refreshTokens, type DbClient } from '@calorie-tracker/db';
import type { LoginInput, RegisterInput } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterInput) {
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
      })
      .returning();

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
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

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; email: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret:
          this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret',
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

    await this.db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
    return this.issueTokens(payload.sub, payload.email);
  }

  private async issueTokens(userId: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret:
          this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret',
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret:
          this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret',
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d',
      },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash: this.hashToken(refreshToken),
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
