import { ApiProperty } from '@nestjs/swagger';

export class TrialBalanceRowDto {
  @ApiProperty({ format: 'uuid' })
  accountId!: string;

  @ApiProperty({ example: '1100' })
  accountCode!: string;

  @ApiProperty({ example: 'Cash' })
  accountName!: string;

  @ApiProperty({ example: 'ASSET' })
  accountType!: string;

  @ApiProperty({ example: '5000.00' })
  totalDebit!: string;

  @ApiProperty({ example: '0.00' })
  totalCredit!: string;
}

export class TrialBalanceResponseDto {
  @ApiProperty({ type: [TrialBalanceRowDto] })
  rows!: TrialBalanceRowDto[];

  @ApiProperty({ example: '5000.00' })
  totalDebit!: string;

  @ApiProperty({ example: '5000.00' })
  totalCredit!: string;
}
