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
import { UomsService } from '../services/uoms.service';
import { CreateUomDto } from '../dto/create-uom.dto';
import { UpdateUomDto } from '../dto/update-uom.dto';
import { ListUomsDto } from '../dto/list-uoms.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { UomResponseDto, toUomResponseDto } from '../dto/uom-response.dto';

const RESOURCE = 'uoms';

@ApiTags('UOMs')
@Controller('uoms')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UomsController {
  constructor(
    private readonly uomsService: UomsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('uoms.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUomsDto,
  ): Promise<{ data: UomResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.uomsService.findAll(companyId, query);
    return {
      data: result.data.map(toUomResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('uoms.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<UomResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return toUomResponseDto(
      await this.uomsService.findByIdInCompany(id, companyId),
    );
  }

  @Post()
  @RequirePermission('uoms.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUomDto,
  ): Promise<UomResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    return toUomResponseDto(
      await this.uomsService.create(companyId, user.id, dto),
    );
  }

  @Patch(':id')
  @RequirePermission('uoms.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUomDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<UomResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return toUomResponseDto(
      await this.uomsService.update(id, companyId, user.id, dto),
    );
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('uoms.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<UomResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return toUomResponseDto(
      await this.uomsService.activate(id, companyId, user.id),
    );
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('uoms.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<UomResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return toUomResponseDto(
      await this.uomsService.deactivate(id, companyId, user.id),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('uoms.delete')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<void> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    await this.uomsService.remove(id, companyId);
  }
}
