import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { createInvitationSchema, type CreateInvitationInput } from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Post('invitations')
  createInvitation(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(createInvitationSchema)) body: CreateInvitationInput,
  ) {
    return this.adminService.createInvitation(body.email, req.user.userId);
  }

  @Get('invitations')
  listInvitations() {
    return this.adminService.listInvitations();
  }
}
