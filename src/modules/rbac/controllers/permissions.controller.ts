import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';

export interface PermissionResponseDto {
  id: string;
  resource: string;
  action: string;
  code: string;
  description: string | null;
}

@ApiTags('RBAC - Permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PermissionsController {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  @Get()
  @RequirePermission('permissions.read')
  async findAll(): Promise<PermissionResponseDto[]> {
    const permissions = await this.permissionRepository.find({
      order: { resource: 'ASC', action: 'ASC' },
    });

    return permissions.map((permission) => ({
      id: permission.id,
      resource: permission.resource,
      action: permission.action,
      code: permission.code,
      description: permission.description,
    }));
  }
}
