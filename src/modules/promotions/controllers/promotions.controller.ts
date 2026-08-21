import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import {
  CreatePromotionDto,
  ListPromotionsDto,
  PromotionResponseDto,
  toPromotionResponseDto,
  UpdatePromotionDto,
} from '../dto/promotions.dto';
import { PromotionsService } from '../services/promotions.service';

const RESOURCE = 'promotions';

@ApiTags('Promotions')
@Controller('promotions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('promotions.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPromotionsDto,
  ): Promise<{ data: PromotionResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.promotionsService.findAll(companyId, query);
    return {
      data: result.data.map(toPromotionResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('promotions.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PromotionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.promotionsService.findByIdInCompany(
      id,
      companyId,
    );
    return toPromotionResponseDto(entity);
  }

  @Post()
  @RequirePermission('promotions.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePromotionDto,
  ): Promise<PromotionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.promotionsService.create(companyId, user.id, dto);
    return toPromotionResponseDto(entity);
  }

  @Patch(':id')
  @RequirePermission('promotions.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromotionDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PromotionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.promotionsService.update(
      id,
      companyId,
      user.id,
      dto,
    );
    return toPromotionResponseDto(entity);
  }
}
