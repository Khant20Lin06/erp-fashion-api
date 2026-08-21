import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';
import { AuthConfig } from '../../../config/auth.config';
import { SafeUserDto } from '../dto/safe-user.dto';
import { AuthLoginResponseDto } from '../dto/auth-login-response.dto';
import { SimpleSuccessResponseDto } from '../../../common/swagger/dto/simple-success-response.dto';
import { ErrorResponseDto } from '../../../common/swagger/dto/error-response.dto';
import { AuthRateLimit } from '../../../common/security/auth-rate-limit.decorator';
import { AuthRateLimitGuard } from '../guards/auth-rate-limit.guard';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('login')
  @ApiOperation({
    summary: 'Authenticate a user and issue a JWT-backed session',
  })
  @ApiOkResponse({
    type: AuthLoginResponseDto,
    description:
      'Authentication succeeded. The response body returns the safe user profile and the server also sets the httpOnly session cookie.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Invalid email or password.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed for the login request body.',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Too many authentication attempts from the same source.',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: SafeUserDto }> {
    const { user, accessToken, refreshToken, refreshExpiresAt } =
      await this.authService.login(dto.email, dto.password);

    this.setAuthCookie(response, accessToken);
    this.setRefreshCookie(response, refreshToken, refreshExpiresAt);

    return { user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Return the currently authenticated user profile' })
  @ApiOkResponse({
    type: SafeUserDto,
    description: 'The authenticated user profile.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Missing, invalid, expired, or revoked JWT session.',
  })
  async me(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SafeUserDto> {
    return this.authService.getCurrentUser(currentUser.id);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Exchange a valid refresh-token cookie for a new short-lived access token',
  })
  @ApiOkResponse({
    type: SimpleSuccessResponseDto,
    description: 'A new access token was issued and both cookies were rotated.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Missing, invalid, expired, or already-used refresh token.',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    const authConfig = this.configService.get<AuthConfig>('auth')!;
    const rawRefreshToken = (
      request.cookies as Record<string, string> | undefined
    )?.[authConfig.refreshCookieName];

    if (!rawRefreshToken) {
      throw new AppException(ErrorCode.Unauthorized, 'Not authenticated');
    }

    const { accessToken, refreshToken, refreshExpiresAt } =
      await this.authService.refresh(rawRefreshToken);

    this.setAuthCookie(response, accessToken);
    this.setRefreshCookie(response, refreshToken, refreshExpiresAt);

    return { success: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Clear the current authenticated session' })
  @ApiOkResponse({
    type: SimpleSuccessResponseDto,
    description: 'The session cookie was cleared successfully.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Authentication is required to log out.',
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    const authConfig = this.configService.get<AuthConfig>('auth')!;
    const rawRefreshToken = (
      request.cookies as Record<string, string> | undefined
    )?.[authConfig.refreshCookieName];

    if (rawRefreshToken) {
      await this.authService.revokeRefreshSession(rawRefreshToken);
    }

    this.clearAuthCookie(response);
    this.clearRefreshCookie(response);
    return { success: true };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Change the current user password' })
  @ApiOkResponse({
    type: SimpleSuccessResponseDto,
    description: 'The password was changed successfully.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description:
      'Authentication is missing/invalid, or the current password is incorrect.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed or the new password is too weak.',
  })
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
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('forgot-password')
  @ApiOperation({
    summary: 'Request a password reset token for a known active user',
  })
  @ApiOkResponse({
    type: SimpleSuccessResponseDto,
    description:
      'Always returns a generic success response to avoid account enumeration.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed for the forgot-password request.',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Too many password reset requests from the same source.',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ success: true }> {
    await this.authService.forgotPassword(dto.email);
    return { success: true };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('reset-password')
  @ApiOperation({ summary: 'Reset a password using a valid reset token' })
  @ApiOkResponse({
    type: SimpleSuccessResponseDto,
    description: 'The password was reset successfully.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed, or the reset token is invalid/expired.',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Too many password reset attempts from the same source.',
  })
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

  private setRefreshCookie(
    response: Response,
    refreshToken: string,
    expiresAt: Date,
  ): void {
    const authConfig = this.configService.get<AuthConfig>('auth')!;

    response.cookie(authConfig.refreshCookieName, refreshToken, {
      httpOnly: true,
      secure: authConfig.cookieSecure,
      sameSite: authConfig.cookieSameSite,
      domain: authConfig.cookieDomain,
      path: authConfig.refreshCookiePath,
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(response: Response): void {
    const authConfig = this.configService.get<AuthConfig>('auth')!;

    response.clearCookie(authConfig.refreshCookieName, {
      httpOnly: true,
      secure: authConfig.cookieSecure,
      sameSite: authConfig.cookieSameSite,
      domain: authConfig.cookieDomain,
      path: authConfig.refreshCookiePath,
    });
  }
}
