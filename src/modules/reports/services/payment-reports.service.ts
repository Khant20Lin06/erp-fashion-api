import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Payment } from '../../payments/entities/payment.entity';
import { PaymentStatus } from '../../payments/entities/payment-status.enum';
import { PaymentDirection } from '../../payments/entities/payment-direction.enum';
import { PaymentReportQueryDto } from '../dto/payment-report-query.dto';

export interface PaymentByDateRow {
  date: string;
  paymentCount: number;
  totalAmount: string;
}

export interface PaymentByDirectionRow {
  direction: PaymentDirection;
  paymentCount: number;
  totalAmount: string;
}

export interface PaymentByMethodRow {
  paymentMethodId: string;
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentCount: number;
  totalAmount: string;
}

/**
 * New Phase 22 report — Payment (by-date/by-direction/by-method), from real
 * Payment data. CONFIRMED only (PaymentStatus.Cancelled is never assigned
 * in practice — see PaymentStatus's own docblock — but filtered explicitly
 * anyway, never trusted implicitly). SQL-level aggregation throughout.
 */
@Injectable()
export class PaymentReportsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  private baseQuery(
    companyId: string,
    query: PaymentReportQueryDto & { allowedBranchIds?: string[] | null },
  ): SelectQueryBuilder<Payment> {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.companyId = :companyId', { companyId })
      .andWhere('payment.status = :status', {
        status: PaymentStatus.Confirmed,
      });

    if (query.branchId) {
      qb.andWhere('payment.branchId = :branchId', {
        branchId: query.branchId,
      });
    } else if (query.allowedBranchIds?.length) {
      qb.andWhere('payment.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: query.allowedBranchIds,
      });
    }
    if (query.fromDate) {
      qb.andWhere('payment.paymentDate >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('payment.paymentDate <= :toDate', { toDate: query.toDate });
    }
    return qb;
  }

  async byDate(
    companyId: string,
    query: PaymentReportQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<PaymentByDateRow[]> {
    const rows = await this.baseQuery(companyId, query)
      .select('DATE(payment.paymentDate)', 'date')
      .addSelect('COUNT(payment.id)', 'paymentCount')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'totalAmount')
      .groupBy('DATE(payment.paymentDate)')
      .orderBy('DATE(payment.paymentDate)', 'ASC')
      .getRawMany<{
        date: string;
        paymentCount: string;
        totalAmount: string;
      }>();

    return rows.map((row) => ({
      date: row.date,
      paymentCount: Number(row.paymentCount),
      totalAmount: Number(row.totalAmount).toFixed(2),
    }));
  }

  async byDirection(
    companyId: string,
    query: PaymentReportQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<PaymentByDirectionRow[]> {
    const rows = await this.baseQuery(companyId, query)
      .select('payment.direction', 'direction')
      .addSelect('COUNT(payment.id)', 'paymentCount')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'totalAmount')
      .groupBy('payment.direction')
      .orderBy('payment.direction', 'ASC')
      .getRawMany<{
        direction: PaymentDirection;
        paymentCount: string;
        totalAmount: string;
      }>();

    return rows.map((row) => ({
      direction: row.direction,
      paymentCount: Number(row.paymentCount),
      totalAmount: Number(row.totalAmount).toFixed(2),
    }));
  }

  async byMethod(
    companyId: string,
    query: PaymentReportQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<PaymentByMethodRow[]> {
    const rows = await this.baseQuery(companyId, query)
      .innerJoin('payment.paymentMethod', 'paymentMethod')
      .select('paymentMethod.id', 'paymentMethodId')
      .addSelect('paymentMethod.code', 'paymentMethodCode')
      .addSelect('paymentMethod.name', 'paymentMethodName')
      .addSelect('COUNT(payment.id)', 'paymentCount')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'totalAmount')
      .groupBy('paymentMethod.id')
      .addGroupBy('paymentMethod.code')
      .addGroupBy('paymentMethod.name')
      .orderBy('totalAmount', 'DESC')
      .getRawMany<{
        paymentMethodId: string;
        paymentMethodCode: string;
        paymentMethodName: string;
        paymentCount: string;
        totalAmount: string;
      }>();

    return rows.map((row) => ({
      paymentMethodId: row.paymentMethodId,
      paymentMethodCode: row.paymentMethodCode,
      paymentMethodName: row.paymentMethodName,
      paymentCount: Number(row.paymentCount),
      totalAmount: Number(row.totalAmount).toFixed(2),
    }));
  }
}
