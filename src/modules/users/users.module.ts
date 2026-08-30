import { forwardRef, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UserCompany } from '../organization/entities/user-company.entity';
import { UsersService } from './services/users.service';
import { UsersController } from './controllers/users.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, PasswordResetToken, UserCompany]),
    forwardRef(() => AuthModule),
    forwardRef(() => RbacModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [TypeOrmModule, UsersService],
})
export class UsersModule {}
