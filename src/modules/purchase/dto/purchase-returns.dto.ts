import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PurchaseReturn } from '../entities/purchase-return.entity';
import { PurchaseReturnItem } from '../entities/purchase-return-item.entity';
import { PurchaseReturnStatus } from '../entities/purchase-return-status.enum';

export class CreatePurchaseReturnItemDto {
  @IsUUID()
  purchaseOrderItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreatePurchaseReturnDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  supplierId!: string;

  @IsUUID()
  purchaseInvoiceId!: string;

  @IsString()
  @MaxLength(255)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnItemDto)
  items!: CreatePurchaseReturnItemDto[];
}

export class ListPurchaseReturnsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  purchaseInvoiceId?: string;

  @IsOptional()
  @IsEnum(PurchaseReturnStatus)
  status?: PurchaseReturnStatus;
}

export interface PurchaseReturnItemResponseDto {
  id: string;
  purchaseOrderItemId: string;
  productVariantId: string;
  quantity: number;
  unitCostSnapshot: string;
  lineTotal: string;
  productNameSnapshot: string;
  skuSnapshot: string;
}

export function toPurchaseReturnItemResponseDto(
  item: PurchaseReturnItem,
): PurchaseReturnItemResponseDto {
  return {
    id: item.id,
    purchaseOrderItemId: item.purchaseOrderItemId,
    productVariantId: item.productVariantId,
    quantity: item.quantity,
    unitCostSnapshot: item.unitCostSnapshot,
    lineTotal: item.lineTotal,
    productNameSnapshot: item.productNameSnapshot,
    skuSnapshot: item.skuSnapshot,
  };
}

export interface PurchaseReturnResponseDto {
  id: string;
  companyId: string;
  branchId: string | null;
  supplierId: string;
  supplierName: string | null;
  purchaseOrderId: string;
  purchaseOrderNumber: string | null;
  purchaseInvoiceId: string;
  purchaseInvoiceNumber: string | null;
  returnNumber: string;
  status: PurchaseReturnStatus;
  reason: string;
  notes: string | null;
  subtotal: string;
  creditAppliedAmount: string;
  supplierCreditAmount: string;
  currency: string;
  createdBy: string | null;
  completedBy: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items?: PurchaseReturnItemResponseDto[];
}

export function toPurchaseReturnResponseDto(
  purchaseReturn: PurchaseReturn,
  items?: PurchaseReturnItem[],
): PurchaseReturnResponseDto {
  return {
    id: purchaseReturn.id,
    companyId: purchaseReturn.companyId,
    branchId: purchaseReturn.branchId,
    supplierId: purchaseReturn.supplierId,
    supplierName:
      purchaseReturn.supplier?.displayName ?? purchaseReturn.supplier?.name ?? null,
    purchaseOrderId: purchaseReturn.purchaseOrderId,
    purchaseOrderNumber:
      purchaseReturn.purchaseOrder?.purchaseOrderNumber ?? null,
    purchaseInvoiceId: purchaseReturn.purchaseInvoiceId,
    purchaseInvoiceNumber:
      purchaseReturn.purchaseInvoice?.invoiceNumber ?? null,
    returnNumber: purchaseReturn.returnNumber,
    status: purchaseReturn.status,
    reason: purchaseReturn.reason,
    notes: purchaseReturn.notes,
    subtotal: purchaseReturn.subtotal,
    creditAppliedAmount: purchaseReturn.creditAppliedAmount,
    supplierCreditAmount: purchaseReturn.supplierCreditAmount,
    currency: purchaseReturn.currency,
    createdBy: purchaseReturn.createdBy,
    completedBy: purchaseReturn.completedBy,
    completedAt: purchaseReturn.completedAt,
    createdAt: purchaseReturn.createdAt,
    updatedAt: purchaseReturn.updatedAt,
    items: (items ?? purchaseReturn.items)?.map(toPurchaseReturnItemResponseDto),
  };
}
