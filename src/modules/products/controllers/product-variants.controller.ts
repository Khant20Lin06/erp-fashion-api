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
// This controller intentionally spans two URL namespaces
// (/products/:productId/variants and /product-variants/:id) rather than a
// single @Controller() prefix, since a variant is both "owned by a
// product" (nested list/create) and "directly addressable" (detail/update/
// activate/deactivate/delete, needed by Barcode/PriceListItem nesting and
// future SKU/barcode lookups). Each route below specifies its own full
// path for this reason.
import { ApiTags } from '@nestjs/swagger';
import { ProductVariantsService } from '../services/product-variants.service';
import { CreateProductVariantDto } from '../dto/create-product-variant.dto';
import { UpdateProductVariantDto } from '../dto/update-product-variant.dto';
import { ListProductVariantsDto } from '../dto/list-product-variants.dto';
import {
  ProductVariantResponseDto,
  toProductVariantResponseDto,
} from '../dto/product-variant-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'product_variants';

@ApiTags('Product Variants')
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProductVariantsController {
  constructor(
    private readonly variantsService: ProductVariantsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get('products/:productId/variants')
  @RequirePermission('product_variants.read')
  async findAllForProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: ListProductVariantsDto,
  ): Promise<{ data: ProductVariantResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.variantsService.findAllForProduct(
      productId,
      companyId,
      query,
    );
    const data = await Promise.all(
      result.data.map(async (variant) =>
        toProductVariantResponseDto(
          variant,
          await this.variantsService.findAttributes(variant.id),
        ),
      ),
    );
    return { data, meta: result.meta };
  }

  @Get('product-variants/:id')
  @RequirePermission('product_variants.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductVariantResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const variant = await this.variantsService.findByIdInCompany(id, companyId);
    return toProductVariantResponseDto(
      variant,
      await this.variantsService.findAttributes(variant.id),
    );
  }

  @Post('products/:productId/variants')
  @RequirePermission('product_variants.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductVariantDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductVariantResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const variant = await this.variantsService.create(
      productId,
      companyId,
      dto,
    );
    return toProductVariantResponseDto(
      variant,
      await this.variantsService.findAttributes(variant.id),
    );
  }

  @Patch('product-variants/:id')
  @RequirePermission('product_variants.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductVariantDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductVariantResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const variant = await this.variantsService.update(id, companyId, dto);
    return toProductVariantResponseDto(
      variant,
      await this.variantsService.findAttributes(variant.id),
    );
  }

  @Post('product-variants/:id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('product_variants.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductVariantResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const variant = await this.variantsService.activate(id, companyId);
    return toProductVariantResponseDto(
      variant,
      await this.variantsService.findAttributes(variant.id),
    );
  }

  @Post('product-variants/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('product_variants.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductVariantResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const variant = await this.variantsService.deactivate(id, companyId);
    return toProductVariantResponseDto(
      variant,
      await this.variantsService.findAttributes(variant.id),
    );
  }

  @Delete('product-variants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('product_variants.delete')
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
    await this.variantsService.remove(id, companyId);
  }
}
