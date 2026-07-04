import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { isRegistrationAllowed } from '../config/env.validation';
import { AuthService } from './auth.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body(zodPipe(registerSchema)) body: RegisterInput) {
    if (!isRegistrationAllowed()) {
      throw new ForbiddenException('Registration is disabled');
    }
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body(zodPipe(loginSchema)) body: LoginInput) {
    return this.authService.login(body);
  }

  @Post('refresh')
  refresh(@Body(zodPipe(refreshSchema)) body: RefreshInput) {
    return this.authService.refresh(body.refreshToken);
  }
}
