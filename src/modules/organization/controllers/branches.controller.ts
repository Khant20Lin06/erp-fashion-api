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
import { BranchesService } from '../services/branches.service';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';
import { ListBranchesDto } from '../dto/list-branches.dto';
import {
  BranchResponseDto,
  toBranchResponseDto,
} from '../dto/branch-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';

@ApiTags('Organization - Branches')
@Controller('branches')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @RequirePermission('branches.read')
  async findAll(
    @Query() query: ListBranchesDto,
  ): Promise<{ data: BranchResponseDto[]; meta: unknown }> {
    const result = await this.branchesService.findAll(query);
    return {
      data: result.data.map(toBranchResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('branches.read')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BranchResponseDto> {
    const branch = await this.branchesService.findById(id);
    return toBranchResponseDto(branch);
  }

  @Post()
  @RequirePermission('branches.create')
  async create(@Body() dto: CreateBranchDto): Promise<BranchResponseDto> {
    const branch = await this.branchesService.create(dto);
    return toBranchResponseDto(branch);
  }

  @Patch(':id')
  @RequirePermission('branches.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchResponseDto> {
    const branch = await this.branchesService.update(id, dto);
    return toBranchResponseDto(branch);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('branches.update')
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BranchResponseDto> {
    const branch = await this.branchesService.activate(id);
    return toBranchResponseDto(branch);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('branches.update')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BranchResponseDto> {
    const branch = await this.branchesService.deactivate(id);
    return toBranchResponseDto(branch);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('branches.delete')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.branchesService.remove(id);
  }
}
