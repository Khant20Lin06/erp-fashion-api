import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingDefinition } from './entities/setting-definition.entity';
import { SettingValue } from './entities/setting-value.entity';
import { SettingsService } from './services/settings.service';
import { SettingsController } from './controllers/settings.controller';
import { RbacModule } from '../rbac/rbac.module';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { Branch } from '../organization/entities/branch.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SettingDefinition, SettingValue, Branch]),
    AuthModule,
    RbacModule,
    RedisModule,
  ],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService, TypeOrmModule],
})
export class SettingsModule {}
