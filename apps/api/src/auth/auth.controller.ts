import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  updateUserPreferencesSchema,
  type ChangePasswordInput,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
  type UpdateUserPreferencesInput,
} from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { isRegistrationAllowed } from '../config/env.validation';
import { InvitationsService } from '../invitations/invitations.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard, type AuthUser } from './jwt-auth.guard';

@Controller('auth')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly invitationsService: InvitationsService,
  ) {}

  @Post('register')
  register(@Body(zodPipe(registerSchema)) body: RegisterInput) {
    const allowWithoutInvite = isRegistrationAllowed();
    if (!allowWithoutInvite && !body.inviteToken) {
      throw new ForbiddenException('Registration is disabled');
    }
    return this.authService.register(body, allowWithoutInvite);
  }

  @Post('login')
  login(@Body(zodPipe(loginSchema)) body: LoginInput) {
    return this.authService.login(body);
  }

  @Post('refresh')
  refresh(@Body(zodPipe(refreshSchema)) body: RefreshInput) {
    return this.authService.refresh(body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: AuthUser }) {
    return this.authService.getMe(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(updateUserPreferencesSchema)) body: UpdateUserPreferencesInput,
  ) {
    return this.authService.updatePreferences(req.user.userId, body);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(changePasswordSchema)) body: ChangePasswordInput,
  ) {
    await this.authService.changePassword(req.user.userId, body);
    return { ok: true };
  }

  @Get('invites/:token/preview')
  previewInvite(@Param('token') token: string) {
    return this.invitationsService.previewInvite(token);
  }
}
