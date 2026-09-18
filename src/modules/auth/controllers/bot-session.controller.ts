import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthConfig } from '../../../config/auth.config';
import { ErrorResponseDto } from '../../../common/swagger/dto/error-response.dto';
import { AuthLoginResponseDto } from '../dto/auth-login-response.dto';
import { LoginDto } from '../dto/login.dto';
import { SafeUserDto } from '../dto/safe-user.dto';
import { BotSessionService } from '../services/bot-session.service';

@ApiTags('Auth')
@Controller('auth')
export class BotSessionController {
  constructor(
    private readonly sessions: BotSessionService,
    private readonly config: ConfigService,
  ) {}

  @Post('bot-session')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Authenticate an allowlisted bot and reuse its short-lived access cookie',
  })
  @ApiOkResponse({
    type: AuthLoginResponseDto,
    description:
      'Safe user profile and HttpOnly access cookie only; no refresh session is created.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Invalid login request.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description:
      'Invalid credentials or bot sessions are not enabled for this account.',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Too many authentication attempts.',
  })
  async create(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: SafeUserDto }> {
    // Credential misses are limited inside the service after a verified cache
    // lookup. The application's global request limiter still covers this route.
    const { user, accessToken } = await this.sessions.getSession(
      dto.email,
      dto.password,
      request.ip || request.socket.remoteAddress || 'unknown',
    );
    const auth = this.config.get<AuthConfig>('auth')!;
    response.cookie(auth.cookieName, accessToken, {
      httpOnly: true,
      secure: auth.cookieSecure,
      sameSite: auth.cookieSameSite,
      domain: auth.cookieDomain,
      path: auth.cookiePath,
    });
    return { user };
  }
}
