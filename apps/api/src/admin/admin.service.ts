import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { users, type DbClient } from '@calorie-tracker/db';
import { DB } from '../database/database.module';
import { toIso } from '../common/serializers';
import { InvitationsService } from '../invitations/invitations.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly invitationsService: InvitationsService,
  ) {}

  async listUsers() {
    const rows = await this.db.query.users.findMany({
      where: eq(users.role, 'client'),
      orderBy: (table, { asc }) => [asc(table.email)],
    });
    return rows.map((user) => ({
      id: user.id,
      email: user.email,
      createdAt: toIso(user.createdAt)!,
    }));
  }

  createInvitation(email: string, invitedBy: string) {
    return this.invitationsService.createInvitation(email, invitedBy);
  }

  listInvitations() {
    return this.invitationsService.listInvitations();
  }
}
