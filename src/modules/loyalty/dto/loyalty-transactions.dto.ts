import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { LoyaltyPointTransaction } from '../entities/loyalty-point-transaction.entity';
import { LoyaltyPointTransactionType } from '../entities/loyalty-point-transaction-type.enum';

export class ListLoyaltyTransactionsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class RedeemLoyaltyPointsDto {
  @IsInt()
  @Min(1)
  points!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export interface LoyaltyPointTransactionResponseDto {
  id: string;
  companyId: string;
  customerId: string;
  type: LoyaltyPointTransactionType;
  pointsDelta: number;
  redemptionValue: string | null;
  sourceType: string | null;
  sourceId: string | null;
  reversesTransactionId: string | null;
  notes: string | null;
  createdAt: Date;
}

export function toLoyaltyPointTransactionResponseDto(
  tx: LoyaltyPointTransaction,
): LoyaltyPointTransactionResponseDto {
  return {
    id: tx.id,
    companyId: tx.companyId,
    customerId: tx.customerId,
    type: tx.type,
    pointsDelta: tx.pointsDelta,
    redemptionValue: tx.redemptionValue,
    sourceType: tx.sourceType,
    sourceId: tx.sourceId,
    reversesTransactionId: tx.reversesTransactionId,
    notes: tx.notes,
    createdAt: tx.createdAt,
  };
}

export interface CustomerLoyaltyBalanceResponseDto {
  customerId: string;
  availablePoints: number;
}
