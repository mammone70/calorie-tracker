import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { invitations, users, type DbClient } from '@calorie-tracker/db';
import { DB } from '../database/database.module';
import { toIso } from '../common/serializers';

const INVITE_EXPIRY_DAYS = 7;

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly config: ConfigService,
  ) {}

  hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async previewInvite(token: string) {
    const invite = await this.findValidInvite(token);
    return {
      email: invite.email,
      expiresAt: toIso(invite.expiresAt)!,
    };
  }

  async consumeInvite(token: string, email: string) {
    const invite = await this.findValidInvite(token);
    if (invite.email !== email.toLowerCase()) {
      throw new BadRequestException('Email does not match invitation');
    }

    await this.db
      .update(invitations)
      .set({ usedAt: new Date() })
      .where(eq(invitations.id, invite.id));

    return invite;
  }

  async createInvitation(email: string, invitedBy: string) {
    const normalizedEmail = email.toLowerCase();
    const existingUser = await this.db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const pending = await this.db.query.invitations.findFirst({
      where: and(eq(invitations.email, normalizedEmail), isNull(invitations.usedAt)),
    });
    if (pending && pending.expiresAt > new Date()) {
      throw new BadRequestException('A pending invitation already exists for this email');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const [invitation] = await this.db
      .insert(invitations)
      .values({
        email: normalizedEmail,
        tokenHash: this.hashToken(token),
        invitedBy,
        expiresAt,
      })
      .returning();

    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173';
    const inviteUrl = `${webOrigin.replace(/\/$/, '')}/register?invite=${token}`;

    return {
      inviteUrl,
      expiresAt: toIso(invitation.expiresAt)!,
      invitation: this.serializeInvitation(invitation),
    };
  }

  async listInvitations() {
    const rows = await this.db.query.invitations.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
    return rows.map((row) => this.serializeInvitation(row));
  }

  serializeInvitation(row: typeof invitations.$inferSelect) {
    return {
      id: row.id,
      email: row.email,
      expiresAt: toIso(row.expiresAt)!,
      usedAt: toIso(row.usedAt),
      createdAt: toIso(row.createdAt)!,
    };
  }

  private async findValidInvite(token: string) {
    const tokenHash = this.hashToken(token);
    const invite = await this.db.query.invitations.findFirst({
      where: eq(invitations.tokenHash, tokenHash),
    });
    if (!invite) {
      throw new NotFoundException('Invitation not found');
    }
    if (invite.usedAt) {
      throw new BadRequestException('Invitation has already been used');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }
    return invite;
  }
}
