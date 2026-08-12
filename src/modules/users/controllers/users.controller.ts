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

@ApiTags('Users - Administration')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission('users.read')
  async findAll(
    @Query() query: ListUsersDto,
  ): Promise<{ data: UserResponseDto[]; meta: unknown }> {
    const result = await this.usersService.findAll(query);
    return {
      data: result.data.map(toUserResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('users.read')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findById(id);
    return toUserResponseDto(user);
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.update(id, dto);
    return toUserResponseDto(user);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('users.activate')
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.activate(id);
    return toUserResponseDto(user);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('users.deactivate')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.deactivate(id);
    return toUserResponseDto(user);
  }

  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('users.lock')
  async lock(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    const user = await this.usersService.lock(id);
    return toUserResponseDto(user);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('users.unlock')
  async unlock(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.unlock(id);
    return toUserResponseDto(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('users.delete')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}
