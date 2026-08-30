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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ListUsersDto } from '../dto/list-users.dto';
import { UserResponseDto, toUserResponseDto } from '../dto/user-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

const RESOURCE = 'users';

@ApiTags('Users - Administration')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  /**
   * Resolves the caller's allowed company ids for the `users` resource
   * (null = DataScope.All / unrestricted). Mirrors resolveRequestCompanyId's
   * use of DataScopeService everywhere else in the codebase, but `users`
   * has no single target companyId per request — a target user can belong
   * to several companies — so UsersService filters/checks membership
   * against the whole allowed set instead of a single resolved id.
   */
  private async resolveAllowedCompanyIds(
    userId: string,
  ): Promise<string[] | null> {
    const resolved = await this.dataScopeService.resolveScope(
      userId,
      RESOURCE,
    );
    if (!resolved) {
      throw new AppException(
        ErrorCode.Forbidden,
        'No data scope is configured for this resource',
      );
    }
    return this.dataScopeService.resolveAllowedCompanyIds(userId, resolved);
  }

  @Get()
  @RequirePermission('users.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUsersDto,
  ): Promise<{ data: UserResponseDto[]; meta: unknown }> {
    const allowedCompanyIds = await this.resolveAllowedCompanyIds(user.id);
    const result = await this.usersService.findAll(query, allowedCompanyIds);
    return {
      data: result.data.map(toUserResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('users.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const allowedCompanyIds = await this.resolveAllowedCompanyIds(user.id);
    const target = await this.usersService.findById(id, allowedCompanyIds);
    return toUserResponseDto(target);
  }

  @Post()
  @RequirePermission('users.create')
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(dto);
    return toUserResponseDto(user);
  }

  @Patch(':id')
  @RequirePermission('users.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const allowedCompanyIds = await this.resolveAllowedCompanyIds(user.id);
    const target = await this.usersService.update(id, dto, allowedCompanyIds);
    return toUserResponseDto(target);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('users.activate')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const allowedCompanyIds = await this.resolveAllowedCompanyIds(user.id);
    const target = await this.usersService.activate(id, allowedCompanyIds);
    return toUserResponseDto(target);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('users.deactivate')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const allowedCompanyIds = await this.resolveAllowedCompanyIds(user.id);
    const target = await this.usersService.deactivate(id, allowedCompanyIds);
    return toUserResponseDto(target);
  }

  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('users.lock')
  async lock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const allowedCompanyIds = await this.resolveAllowedCompanyIds(user.id);
    const target = await this.usersService.lock(id, allowedCompanyIds);
    return toUserResponseDto(target);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('users.unlock')
  async unlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const allowedCompanyIds = await this.resolveAllowedCompanyIds(user.id);
    const target = await this.usersService.unlock(id, allowedCompanyIds);
    return toUserResponseDto(target);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('users.delete')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const allowedCompanyIds = await this.resolveAllowedCompanyIds(user.id);
    await this.usersService.remove(id, allowedCompanyIds);
  }
}
