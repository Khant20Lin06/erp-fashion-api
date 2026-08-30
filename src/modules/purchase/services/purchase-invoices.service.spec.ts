import { Repository } from 'typeorm';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { PurchaseInvoice } from '../entities/purchase-invoice.entity';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { GoodsReceipt } from '../../inventory/entities/goods-receipt.entity';
import { Supplier } from '../../customer-supplier/entities/supplier.entity';
import { PurchaseOrderStatus } from '../entities/purchase-order-status.enum';
import { PurchaseInvoiceStatus } from '../entities/purchase-invoice-status.enum';

describe('PurchaseInvoicesService', () => {
  let service: PurchaseInvoicesService;
  let purchaseInvoiceRepository: jest.Mocked<
    Pick<
      Repository<PurchaseInvoice>,
      'find' | 'findAndCount' | 'findOne' | 'save' | 'create'
    >
  >;
  let purchaseOrderRepository: jest.Mocked<
    Pick<Repository<PurchaseOrder>, 'createQueryBuilder' | 'findOne'>
  >;
  let goodsReceiptRepository: jest.Mocked<Pick<Repository<GoodsReceipt>, 'find'>>;
  let supplierRepository: jest.Mocked<Pick<Repository<Supplier>, 'findBy'>>;
  let orderQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(() => {
    purchaseInvoiceRepository = {
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((_data: unknown) => _data as PurchaseInvoice),
    };
    orderQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    purchaseOrderRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(orderQueryBuilder),
      findOne: jest.fn(),
    };
    goodsReceiptRepository = {
      find: jest.fn(),
    };
    supplierRepository = {
      findBy: jest.fn(),
    };

    service = new PurchaseInvoicesService(
      purchaseInvoiceRepository as unknown as Repository<PurchaseInvoice>,
      purchaseOrderRepository as unknown as Repository<PurchaseOrder>,
      goodsReceiptRepository as unknown as Repository<GoodsReceipt>,
      supplierRepository as unknown as Repository<Supplier>,
    );
  });

  it('does not auto-create a replacement invoice for a voided purchase invoice', async () => {
    const purchaseOrder = {
      id: 'po-1',
      companyId: 'company-a',
      supplierId: 'supplier-1',
      purchaseOrderNumber: 'PO-2026-000010',
      transactionDate: new Date('2026-08-24T00:00:00.000Z'),
      status: PurchaseOrderStatus.Approved,
      subtotal: '8.00',
      discountAmount: '0.00',
      taxAmount: '0.00',
      grandTotal: '8.00',
      paidAmount: '0.00',
      balanceAmount: '8.00',
      currency: 'USD',
      createdBy: 'user-1',
      updatedBy: 'user-1',
    } as PurchaseOrder;
    const goodsReceipt = {
      id: 'gr-1',
      companyId: 'company-a',
      purchaseOrderId: 'po-1',
      receiptDate: new Date('2026-08-24T01:00:00.000Z'),
    } as GoodsReceipt;
    const voidedInvoice = {
      id: 'inv-1',
      companyId: 'company-a',
      supplierId: 'supplier-1',
      purchaseOrderId: 'po-1',
      invoiceNumber: 'PINV-2026-000010',
      invoiceDate: new Date('2026-08-24T01:00:00.000Z'),
      dueDate: new Date('2026-08-24T01:00:00.000Z'),
      status: PurchaseInvoiceStatus.Voided,
      subtotal: '8.00',
      discountAmount: '0.00',
      taxAmount: '0.00',
      grandTotal: '8.00',
      paidAmount: '0.00',
      creditedAmount: '0.00',
      balanceAmount: '0.00',
      currency: 'USD',
      voidedAt: new Date('2026-08-24T02:00:00.000Z'),
      voidedBy: 'user-1',
      voidReason: 'test',
    } as PurchaseInvoice;

    orderQueryBuilder.getMany.mockResolvedValue([purchaseOrder]);
    goodsReceiptRepository.find.mockResolvedValue([goodsReceipt]);
    supplierRepository.findBy.mockResolvedValue([]);
    purchaseInvoiceRepository.find
      .mockResolvedValueOnce([voidedInvoice])
      .mockResolvedValueOnce([voidedInvoice]);
    purchaseInvoiceRepository.findAndCount.mockResolvedValue([
      [voidedInvoice],
      1,
    ]);

    const result = await service.findAll('company-a', {
      companyId: 'company-a',
      supplierId: 'supplier-1',
      limit: 100,
    });

    expect(purchaseInvoiceRepository.save).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('inv-1');
    expect(result.data[0]?.status).toBe(PurchaseInvoiceStatus.Voided);
  });
});
