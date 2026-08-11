import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRolesService } from '../services/user-roles.service';
import { ReplaceUserRolesDto } from '../dto/replace-user-roles.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';

interface RoleSummaryDto {
  id: string;
  name: string;
  code: string;
}

@ApiTags('RBAC - User Roles')
@Controller('users/:userId/roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UserRolesController {
  constructor(private readonly userRolesService: UserRolesService) {}

  @Get()
  @RequirePermission('user_roles.read')
  async list(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<RoleSummaryDto[]> {
    const roles = await this.userRolesService.listForUser(userId);
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      code: role.code,
    }));
  }

  @Put()
  @RequirePermission('user_roles.assign')
  async replace(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ReplaceUserRolesDto,
  ): Promise<RoleSummaryDto[]> {
    const roles = await this.userRolesService.replaceForUser(userId, dto);
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      code: role.code,
    }));
  }
}
