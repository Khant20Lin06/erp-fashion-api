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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { ProductVariantUomsService } from '../services/product-variant-uoms.service';
import { CreateProductVariantUomDto } from '../dto/create-product-variant-uom.dto';
import { UpdateProductVariantUomDto } from '../dto/update-product-variant-uom.dto';
import {
  ProductVariantUomResponseDto,
  toProductVariantUomResponseDto,
} from '../dto/product-variant-uom-response.dto';

const RESOURCE = 'product_variant_uoms';

@ApiTags('Product Variant UOMs')
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProductVariantUomsController {
  constructor(
    private readonly variantUomsService: ProductVariantUomsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get('product-variants/:variantId/uoms')
  @RequirePermission('product_variant_uoms.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductVariantUomResponseDto[]> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const mappings = await this.variantUomsService.findAllForVariant(
      variantId,
      companyId,
    );
    return mappings.map(toProductVariantUomResponseDto);
  }

  @Post('product-variants/:variantId/uoms')
  @RequirePermission('product_variant_uoms.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: CreateProductVariantUomDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductVariantUomResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return toProductVariantUomResponseDto(
      await this.variantUomsService.create(variantId, companyId, user.id, dto),
    );
  }

  @Patch('product-variant-uoms/:id')
  @RequirePermission('product_variant_uoms.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductVariantUomDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductVariantUomResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return toProductVariantUomResponseDto(
      await this.variantUomsService.update(id, companyId, user.id, dto),
    );
  }

  @Post('product-variant-uoms/:id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('product_variant_uoms.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductVariantUomResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return toProductVariantUomResponseDto(
      await this.variantUomsService.activate(id, companyId, user.id),
    );
  }

  @Post('product-variant-uoms/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('product_variant_uoms.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductVariantUomResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return toProductVariantUomResponseDto(
      await this.variantUomsService.deactivate(id, companyId, user.id),
    );
  }

  @Delete('product-variant-uoms/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('product_variant_uoms.delete')
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
    await this.variantUomsService.remove(id, companyId);
  }
}
