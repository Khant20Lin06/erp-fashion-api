import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolesService } from '../services/roles.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { ReplaceRolePermissionsDto } from '../dto/replace-role-permissions.dto';
import { ReplaceRoleScopesDto } from '../dto/replace-role-scopes.dto';
import { RoleResponseDto, toRoleResponseDto } from '../dto/role-response.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';

@ApiTags('RBAC - Roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission('roles.read')
  async findAll(
    @Query() pagination: PaginationDto,
  ): Promise<{ data: RoleResponseDto[]; meta: unknown }> {
    const result = await this.rolesService.findAll(pagination);
    return {
      data: result.data.map(toRoleResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('roles.read')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoleResponseDto> {
    const role = await this.rolesService.findById(id);
    return toRoleResponseDto(role);
  }

  @Post()
  @RequirePermission('roles.create')
  async create(@Body() dto: CreateRoleDto): Promise<RoleResponseDto> {
    const role = await this.rolesService.create(dto);
    return toRoleResponseDto(role);
  }

  @Patch(':id')
  @RequirePermission('roles.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    const role = await this.rolesService.update(id, dto);
    return toRoleResponseDto(role);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('roles.update')
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoleResponseDto> {
    const role = await this.rolesService.activate(id);
    return toRoleResponseDto(role);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('roles.update')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoleResponseDto> {
    const role = await this.rolesService.deactivate(id);
    return toRoleResponseDto(role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('roles.delete')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.rolesService.remove(id);
  }

  @Put(':id/permissions')
  @RequirePermission('roles.update')
  async replacePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceRolePermissionsDto,
  ): Promise<RoleResponseDto> {
    const role = await this.rolesService.replacePermissions(id, dto);
    return toRoleResponseDto(role);
  }

  @Put(':id/scopes')
  @RequirePermission('roles.update')
  async replaceScopes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceRoleScopesDto,
  ): Promise<RoleResponseDto> {
    const role = await this.rolesService.replaceScopes(id, dto);
    return toRoleResponseDto(role);
  }
}
