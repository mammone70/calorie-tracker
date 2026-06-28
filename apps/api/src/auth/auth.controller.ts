import { Body, Controller, Post } from '@nestjs/common';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body(zodPipe(registerSchema)) body: RegisterInput) {
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
