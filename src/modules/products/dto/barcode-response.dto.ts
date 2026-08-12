import { ProductVariantBarcode } from '../entities/product-variant-barcode.entity';
import { BarcodeStatus } from '../entities/barcode-status.enum';

export interface BarcodeResponseDto {
  id: string;
  variantId: string;
  companyId: string;
  barcode: string;
  status: BarcodeStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toBarcodeResponseDto(
  barcode: ProductVariantBarcode,
): BarcodeResponseDto {
  return {
    id: barcode.id,
    variantId: barcode.variantId,
    companyId: barcode.companyId,
    barcode: barcode.barcode,
    status: barcode.status,
    createdAt: barcode.createdAt,
    updatedAt: barcode.updatedAt,
  };
}
