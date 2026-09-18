import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PosShift } from '../entities/pos-shift.entity';
import { PosShiftStatus } from '../entities/pos-shift-status.enum';
import { Sale } from '../entities/sale.entity';
import { SaleStatus } from '../entities/sale-status.enum';
import { OpenPosShiftDto } from '../dto/open-pos-shift.dto';
import { ClosePosShiftDto } from '../dto/close-pos-shift.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { Payment } from '../../payments/entities/payment.entity';
import { PaymentStatus } from '../../payments/entities/payment-status.enum';

@Injectable()
export class PosShiftsService {
  constructor(
    @InjectRepository(PosShift)
    private readonly posShiftRepository: Repository<PosShift>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async getCurrentShift(
    companyId: string,
    branchId?: string,
    cashierId?: string,
  ): Promise<PosShift | null> {
    const qb = this.posShiftRepository
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.cashier', 'cashier')
      .leftJoinAndSelect('shift.branch', 'branch')
      .where('shift.companyId = :companyId', { companyId })
      .andWhere('shift.status = :status', { status: PosShiftStatus.Open });

    if (branchId) {
      qb.andWhere('shift.branchId = :branchId', { branchId });
    }
    if (cashierId) {
      qb.andWhere('shift.cashierId = :cashierId', { cashierId });
    }

    qb.orderBy('shift.openedAt', 'DESC');
    return qb.getOne();
  }

  async openShift(
    companyId: string,
    cashierId: string,
    dto: OpenPosShiftDto,
  ): Promise<PosShift> {
    const existing = await this.getCurrentShift(
      companyId,
      dto.branchId,
      cashierId,
    );
    if (existing) {
      return existing;
    }

    const shiftNumber = `SH-${Date.now().toString().slice(-6)}`;
    const openingCash = dto.openingCash || '0.00';

    const shift = this.posShiftRepository.create({
      companyId,
      branchId: dto.branchId,
      cashierId,
      shiftNumber,
      status: PosShiftStatus.Open,
      openedAt: new Date(),
      openingCash,
      expectedCash: openingCash,
      notes: dto.notes || null,
    });

    return this.posShiftRepository.save(shift);
  }

  async closeShift(
    companyId: string,
    shiftId: string,
    dto: ClosePosShiftDto,
  ): Promise<PosShift> {
    const shift = await this.posShiftRepository.findOne({
      where: { id: shiftId, companyId },
      relations: ['cashier', 'branch'],
    });

    if (!shift) {
      throw new AppException(ErrorCode.NotFound, 'Shift not found');
    }
    if (shift.status === PosShiftStatus.Closed) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Shift is already closed',
      );
    }

    const closedAt = new Date();

    // Query sales during shift
    const sales = await this.saleRepository
      .createQueryBuilder('s')
      .where('s.companyId = :companyId', { companyId })
      .andWhere('s.branchId = :branchId', { branchId: shift.branchId })
      .andWhere('s.createdAt >= :openedAt', { openedAt: shift.openedAt })
      .andWhere('s.createdAt <= :closedAt', { closedAt })
      .andWhere('s.status = :status', { status: SaleStatus.Confirmed })
      .andWhere('s.deletedAt IS NULL')
      .getMany();

    const totalSalesCount = sales.length;
    let totalSalesAmount = 0;
    for (const s of sales) {
      totalSalesAmount += parseFloat(s.grandTotal || '0');
    }

    // Query payments in this branch during shift
    const payments = await this.paymentRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.paymentMethod', 'pm')
      .where('p.companyId = :companyId', { companyId })
      .andWhere('p.branchId = :branchId', { branchId: shift.branchId })
      .andWhere('p.createdAt >= :openedAt', { openedAt: shift.openedAt })
      .andWhere('p.createdAt <= :closedAt', { closedAt })
      .andWhere('p.status = :status', { status: PaymentStatus.Confirmed })
      .getMany();

    const paymentSummary: Record<string, number> = {
      cash: 0,
      card: 0,
      mobile: 0,
      other: 0,
    };

    let cashCollected = 0;
    if (payments.length > 0) {
      for (const p of payments) {
        const amt = parseFloat(p.amount || '0');
        const code = (p.paymentMethod?.code || '').toLowerCase();
        if (code.includes('cash')) {
          paymentSummary.cash += amt;
          cashCollected += amt;
        } else if (code.includes('card') || code.includes('visa')) {
          paymentSummary.card += amt;
        } else if (
          code.includes('pay') ||
          code.includes('kpay') ||
          code.includes('wave')
        ) {
          paymentSummary.mobile += amt;
        } else {
          paymentSummary.other += amt;
        }
      }
    } else {
      // If separate payment records were not created, attribute total sales to cash as baseline
      cashCollected = totalSalesAmount;
      paymentSummary.cash = totalSalesAmount;
    }

    const openingCash = parseFloat(shift.openingCash || '0');
    const expectedCash = openingCash + cashCollected;
    const actualCash = parseFloat(dto.actualCash || '0');
    const cashDifference = actualCash - expectedCash;

    shift.status = PosShiftStatus.Closed;
    shift.closedAt = closedAt;
    shift.totalSalesCount = totalSalesCount;
    shift.totalSalesAmount = totalSalesAmount.toFixed(2);
    shift.expectedCash = expectedCash.toFixed(2);
    shift.actualCash = actualCash.toFixed(2);
    shift.cashDifference = cashDifference.toFixed(2);
    shift.paymentSummary = paymentSummary;
    if (dto.notes) {
      shift.notes = shift.notes
        ? `${shift.notes}\n${dto.notes}`
        : dto.notes;
    }

    return this.posShiftRepository.save(shift);
  }

  async listShifts(
    companyId: string,
    branchId?: string,
    limit = 20,
  ): Promise<PosShift[]> {
    const qb = this.posShiftRepository
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.cashier', 'cashier')
      .leftJoinAndSelect('shift.branch', 'branch')
      .where('shift.companyId = :companyId', { companyId });

    if (branchId) {
      qb.andWhere('shift.branchId = :branchId', { branchId });
    }

    qb.orderBy('shift.openedAt', 'DESC').take(limit);
    return qb.getMany();
  }

  async getShiftById(companyId: string, shiftId: string): Promise<PosShift> {
    const shift = await this.posShiftRepository.findOne({
      where: { id: shiftId, companyId },
      relations: ['cashier', 'branch'],
    });
    if (!shift) {
      throw new AppException(ErrorCode.NotFound, 'Shift not found');
    }
    return shift;
  }
}
