import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { RefreshSession } from './entities/refresh-session.entity';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { BotSessionService } from './services/bot-session.service';
import { BotSessionController } from './controllers/bot-session.controller';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshSession]),
  ],
  controllers: [AuthController, BotSessionController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    JwtAuthGuard,
    AuthRateLimitGuard,
    BotSessionService,
  ],
  exports: [JwtAuthGuard, TokenService, PasswordService],
})
export class AuthModule {}
