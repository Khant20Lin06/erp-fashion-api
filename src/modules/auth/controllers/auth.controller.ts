import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';
import { AuthConfig } from '../../../config/auth.config';
import type { SafeUserDto } from '../dto/safe-user.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: SafeUserDto }> {
    const { user, accessToken } = await this.authService.login(
      dto.email,
      dto.password,
    );

    this.setAuthCookie(response, accessToken);

    return { user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SafeUserDto> {
    return this.authService.getCurrentUser(currentUser.id);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logout(@Res({ passthrough: true }) response: Response): { success: true } {
    this.clearAuthCookie(response);
    return { success: true };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    await this.authService.changePassword(
      currentUser.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { success: true };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ success: true }> {
    await this.authService.forgotPassword(dto.email);
    return { success: true };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ success: true }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { success: true };
  }

  private setAuthCookie(response: Response, accessToken: string): void {
    const authConfig = this.configService.get<AuthConfig>('auth')!;

    response.cookie(authConfig.cookieName, accessToken, {
      httpOnly: true,
      secure: authConfig.cookieSecure,
      sameSite: authConfig.cookieSameSite,
      domain: authConfig.cookieDomain,
      path: authConfig.cookiePath,
    });
  }

  private clearAuthCookie(response: Response): void {
    const authConfig = this.configService.get<AuthConfig>('auth')!;

    response.clearCookie(authConfig.cookieName, {
      httpOnly: true,
      secure: authConfig.cookieSecure,
      sameSite: authConfig.cookieSameSite,
      domain: authConfig.cookieDomain,
      path: authConfig.cookiePath,
    });
  }
}
