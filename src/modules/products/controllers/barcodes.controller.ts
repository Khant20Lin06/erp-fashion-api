import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BarcodesService } from '../services/barcodes.service';
import { CreateBarcodeDto } from '../dto/create-barcode.dto';
import {
  BarcodeResponseDto,
  toBarcodeResponseDto,
} from '../dto/barcode-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'barcodes';

@ApiTags('Product Variant Barcodes')
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BarcodesController {
  constructor(
    private readonly barcodesService: BarcodesService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get('product-variants/:variantId/barcodes')
  @RequirePermission('barcodes.read')
  async findAllForVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<{ data: BarcodeResponseDto[] }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const barcodes = await this.barcodesService.findAllForVariant(
      variantId,
      companyId,
    );
    return { data: barcodes.map(toBarcodeResponseDto) };
  }

  @Post('product-variants/:variantId/barcodes')
  @RequirePermission('barcodes.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: CreateBarcodeDto,
  ): Promise<BarcodeResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const barcode = await this.barcodesService.create(
      variantId,
      companyId,
      dto,
    );
    return toBarcodeResponseDto(barcode);
  }

  @Post('barcodes/:id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('barcodes.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<BarcodeResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const barcode = await this.barcodesService.activate(id, companyId);
    return toBarcodeResponseDto(barcode);
  }

  @Post('barcodes/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('barcodes.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<BarcodeResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const barcode = await this.barcodesService.deactivate(id, companyId);
    return toBarcodeResponseDto(barcode);
  }

  @Delete('barcodes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('barcodes.delete')
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
    await this.barcodesService.remove(id, companyId);
  }
}
