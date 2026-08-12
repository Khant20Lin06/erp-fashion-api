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
import { BrandsService } from '../services/brands.service';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { ListBrandsDto } from '../dto/list-brands.dto';
import {
  BrandResponseDto,
  toBrandResponseDto,
} from '../dto/brand-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../utils/resolve-request-company-id';

const RESOURCE = 'brands';

@ApiTags('Master Data - Brands')
@Controller('brands')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BrandsController {
  constructor(
    private readonly brandsService: BrandsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('brands.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBrandsDto,
  ): Promise<{ data: BrandResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.brandsService.findAll(companyId, query);
    return {
      data: result.data.map(toBrandResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('brands.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<BrandResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const brand = await this.brandsService.findByIdInCompany(id, companyId);
    return toBrandResponseDto(brand);
  }

  @Post()
  @RequirePermission('brands.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBrandDto,
  ): Promise<BrandResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const brand = await this.brandsService.create(companyId, dto);
    return toBrandResponseDto(brand);
  }

  @Patch(':id')
  @RequirePermission('brands.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<BrandResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const brand = await this.brandsService.update(id, companyId, dto);
    return toBrandResponseDto(brand);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('brands.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<BrandResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const brand = await this.brandsService.activate(id, companyId);
    return toBrandResponseDto(brand);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('brands.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<BrandResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const brand = await this.brandsService.deactivate(id, companyId);
    return toBrandResponseDto(brand);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('brands.delete')
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
    await this.brandsService.remove(id, companyId);
  }
}
