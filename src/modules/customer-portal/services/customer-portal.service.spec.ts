import { Repository } from 'typeorm';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerTelegramLink } from '../entities/customer-telegram-link.entity';
import { LinkStatus } from '../entities/link-status.enum';
import { TelegramLinkOtp } from '../entities/telegram-link-otp.entity';
import { hashOtpCode } from '../utils/otp.util';
import { Customer } from '../../customer-supplier/entities/customer.entity';
import { CustomerStatus } from '../../customer-supplier/entities/customer-status.enum';
import { CustomersService } from '../../customer-supplier/services/customers.service';
import { CompaniesService } from '../../organization/services/companies.service';
import { SalesService } from '../../sales/services/sales.service';
import { ProductVariantsService } from '../../products/services/product-variants.service';
import { OnlineOrdersService } from '../../online-orders/services/online-orders.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('CustomerPortalService', () => {
  let service: CustomerPortalService;
  let linkRepository: jest.Mocked<
    Pick<Repository<CustomerTelegramLink>, 'findOne' | 'create' | 'save'>
  >;
  let otpRepository: jest.Mocked<
    Pick<Repository<TelegramLinkOtp>, 'findOne' | 'create' | 'save' | 'update'>
  >;
  let customersService: jest.Mocked<
    Pick<CustomersService, 'findActiveByPhone' | 'create' | 'update'>
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let salesService: jest.Mocked<
    Pick<SalesService, 'create' | 'findByCreationKey'>
  >;
  let productVariantsService: jest.Mocked<
    Pick<
      ProductVariantsService,
      'findBySkuInCompany' | 'findBySkuInCompanyWithProduct'
    >
  >;
  let onlineOrdersService: jest.Mocked<
    Pick<OnlineOrdersService, 'createForSale'>
  >;

  const buildCustomer = (overrides: Partial<Customer> = {}): Customer =>
    ({
      id: 'customer-1',
      companyId: 'company-1',
      name: 'Telegram Customer 09123456789',
      phone: '09123456789',
      status: CustomerStatus.Active,
      ...overrides,
    }) as Customer;

  const buildOtp = (
    overrides: Partial<TelegramLinkOtp> = {},
  ): TelegramLinkOtp =>
    ({
      id: 'otp-1',
      telegramUserId: 'tg-1',
      phone: '09123456789',
      companyId: 'company-1',
      codeHash: hashOtpCode('123456'),
      attemptCount: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      ...overrides,
    }) as TelegramLinkOtp;

  beforeEach(() => {
    linkRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    linkRepository.create.mockImplementation(
      (input) => input as CustomerTelegramLink,
    );
    linkRepository.save.mockImplementation((input) =>
      Promise.resolve(input as CustomerTelegramLink),
    );
    otpRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    otpRepository.create.mockImplementation(
      (input) => input as TelegramLinkOtp,
    );
    otpRepository.save.mockImplementation((input) =>
      Promise.resolve(input as TelegramLinkOtp),
    );
    customersService = {
      findActiveByPhone: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    companiesService = {
      findActiveByIdOrNull: jest.fn().mockResolvedValue({
        id: 'company-1',
        baseCurrency: 'MMK',
      }),
    };
    salesService = {
      create: jest.fn(),
      findByCreationKey: jest.fn().mockResolvedValue(null),
    };
    productVariantsService = {
      findBySkuInCompany: jest.fn(),
      findBySkuInCompanyWithProduct: jest.fn(),
    };
    onlineOrdersService = { createForSale: jest.fn() };

    service = new CustomerPortalService(
      linkRepository as unknown as Repository<CustomerTelegramLink>,
      otpRepository as unknown as Repository<TelegramLinkOtp>,
      customersService as unknown as CustomersService,
      companiesService as unknown as CompaniesService,
      salesService as unknown as SalesService,
      productVariantsService as unknown as ProductVariantsService,
      onlineOrdersService as unknown as OnlineOrdersService,
    );
  });

  describe('requestLink', () => {
    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.requestLink('tg-1', 'bad-company', '09123456789'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('generates and persists a hashed 6-digit OTP, returning the raw code', async () => {
      const result = await service.requestLink(
        'tg-1',
        'company-1',
        '09123456789',
      );

      expect(result.code).toMatch(/^\d{6}$/);
      expect(otpRepository.save).toHaveBeenCalled();
      const saved = otpRepository.save.mock.calls[0][0] as TelegramLinkOtp;
      expect(saved.codeHash).not.toBe(result.code);
      expect(saved.codeHash).toBe(hashOtpCode(result.code));
    });

    it('supersedes any previous unconsumed OTP for the same Telegram user', async () => {
      await service.requestLink('tg-1', 'company-1', '09123456789');

      expect(otpRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ telegramUserId: 'tg-1' }),
        expect.objectContaining({ consumedAt: expect.any(Date) as unknown }),
      );
    });
  });

  describe('verifyLinkAndGetCustomer', () => {
    it('rejects when there is no pending OTP for this Telegram user', async () => {
      otpRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyLinkAndGetCustomer('tg-1', '123456'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects an expired OTP', async () => {
      otpRepository.findOne.mockResolvedValue(
        buildOtp({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.verifyLinkAndGetCustomer('tg-1', '123456'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects once attemptCount has reached the max, without checking the code', async () => {
      otpRepository.findOne.mockResolvedValue(buildOtp({ attemptCount: 5 }));

      await expect(
        service.verifyLinkAndGetCustomer('tg-1', '123456'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(otpRepository.save).not.toHaveBeenCalled();
    });

    it('rejects an incorrect code and increments attemptCount', async () => {
      const otp = buildOtp();
      otpRepository.findOne.mockResolvedValue(otp);

      await expect(
        service.verifyLinkAndGetCustomer('tg-1', '000000'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(otpRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ attemptCount: 1 }),
      );
    });

    it('links to an existing customer by phone when one already exists', async () => {
      const otp = buildOtp();
      otpRepository.findOne.mockResolvedValue(otp);
      const existingCustomer = buildCustomer();
      customersService.findActiveByPhone.mockResolvedValue(existingCustomer);
      linkRepository.findOne.mockResolvedValue(null);

      const result = await service.verifyLinkAndGetCustomer('tg-1', '123456');

      expect(result).toBe(existingCustomer);
      expect(customersService.create).not.toHaveBeenCalled();
      expect(otp.consumedAt).toBeInstanceOf(Date);
    });

    it('creates a minimal customer when no existing customer matches the phone', async () => {
      const otp = buildOtp();
      otpRepository.findOne.mockResolvedValue(otp);
      customersService.findActiveByPhone.mockResolvedValue(null);
      const newCustomer = buildCustomer({ id: 'customer-new' });
      customersService.create.mockResolvedValue(newCustomer);
      linkRepository.findOne.mockResolvedValue(null);

      const result = await service.verifyLinkAndGetCustomer('tg-1', '123456');

      expect(result).toBe(newCustomer);
      expect(customersService.create).toHaveBeenCalledWith(
        'company-1',
        expect.objectContaining({ phone: '09123456789' }),
      );
    });

    it('updates the existing link row in place on re-verification (never a second row for the same Telegram user)', async () => {
      const otp = buildOtp();
      otpRepository.findOne.mockResolvedValue(otp);
      customersService.findActiveByPhone.mockResolvedValue(buildCustomer());
      const existingLink = {
        telegramUserId: 'tg-1',
        customerId: 'old-customer',
        status: LinkStatus.Revoked,
        linkedAt: new Date(0),
        revokedAt: new Date(0),
      } as CustomerTelegramLink;
      linkRepository.findOne.mockResolvedValue(existingLink);

      await service.verifyLinkAndGetCustomer('tg-1', '123456');

      expect(linkRepository.create).not.toHaveBeenCalled();
      expect(linkRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'customer-1',
          status: LinkStatus.Active,
          revokedAt: null,
        }),
      );
    });
  });

  describe('getLinkedCustomerOrThrow', () => {
    it('returns the linked customer for an ACTIVE link', async () => {
      const customer = buildCustomer();
      linkRepository.findOne.mockResolvedValue({
        telegramUserId: 'tg-1',
        status: LinkStatus.Active,
        customer,
      } as CustomerTelegramLink);

      await expect(service.getLinkedCustomerOrThrow('tg-1')).resolves.toBe(
        customer,
      );
    });

    it('throws Forbidden when there is no active link (unlinked Telegram user)', async () => {
      linkRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getLinkedCustomerOrThrow('tg-1'),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.Forbidden,
      });
    });
  });

  describe('createOrder', () => {
    it('recovers a failed online-order write using the committed sale even if its SKU was removed', async () => {
      linkRepository.findOne.mockResolvedValue({
        status: LinkStatus.Active,
        customer: buildCustomer(),
      } as CustomerTelegramLink);
      productVariantsService.findBySkuInCompany.mockResolvedValue({
        id: 'variant-1',
      } as never);
      const sale = { id: 'sale-1' } as never;
      salesService.create.mockResolvedValue(sale);
      onlineOrdersService.createForSale
        .mockRejectedValueOnce(new Error('database unavailable'))
        .mockResolvedValue({ id: 'order-1' } as never);
      const dto = {
        telegramUserId: 'tg-1',
        idempotencyKey: 'checkout-1',
        deliveryAddress: 'Yangon',
        items: [{ sku: 'SKU-1', quantity: 2 }],
      };
      await expect(service.createOrder('bot-1', dto)).rejects.toThrow(
        'database unavailable',
      );
      salesService.findByCreationKey.mockResolvedValue(sale);
      productVariantsService.findBySkuInCompany.mockResolvedValue(null);
      expect((await service.createOrder('bot-1', dto)).sale).toBe(sale);
      expect(salesService.create).toHaveBeenCalledTimes(1);
      expect(productVariantsService.findBySkuInCompany).toHaveBeenCalledTimes(
        1,
      );
    });
    it('resolves the customer from telegramUserId and never trusts a client-supplied customerId', async () => {
      const customer = buildCustomer();
      linkRepository.findOne.mockResolvedValue({
        telegramUserId: 'tg-1',
        status: LinkStatus.Active,
        customer,
      } as CustomerTelegramLink);
      productVariantsService.findBySkuInCompany.mockResolvedValue({
        id: 'variant-1',
      } as never);
      salesService.create.mockResolvedValue({ id: 'sale-1' } as never);
      onlineOrdersService.createForSale.mockResolvedValue({
        id: 'online-order-1',
      } as never);

      const result = await service.createOrder('bot-user-1', {
        telegramUserId: 'tg-1',
        deliveryAddress: '123 Main St',
        telegramUsername: 'shopper1',
        items: [{ sku: 'SKU-001', quantity: 2 }],
      });

      expect(salesService.create).toHaveBeenCalledWith(
        'company-1',
        'bot-user-1',
        expect.objectContaining({
          customerId: 'customer-1',
          currency: 'MMK',
          items: [{ productVariantId: 'variant-1', quantity: 2 }],
        }),
      );
      expect(onlineOrdersService.createForSale).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          saleId: 'sale-1',
          customerId: 'customer-1',
          telegramUserId: 'tg-1',
          telegramUsername: 'shopper1',
          deliveryAddress: '123 Main St',
        }),
      );
      expect(result.sale).toEqual({ id: 'sale-1' });
      expect(result.onlineOrder).toEqual({ id: 'online-order-1' });
    });

    it('rejects when the Telegram user has no linked customer', async () => {
      linkRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createOrder('bot-user-1', {
          telegramUserId: 'tg-unlinked',
          deliveryAddress: '123 Main St',
          items: [{ sku: 'SKU-001', quantity: 1 }],
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Forbidden });
      expect(salesService.create).not.toHaveBeenCalled();
    });

    it('rejects when a SKU does not resolve to a real product variant', async () => {
      const customer = buildCustomer();
      linkRepository.findOne.mockResolvedValue({
        telegramUserId: 'tg-1',
        status: LinkStatus.Active,
        customer,
      } as CustomerTelegramLink);
      productVariantsService.findBySkuInCompany.mockResolvedValue(null);

      await expect(
        service.createOrder('bot-user-1', {
          telegramUserId: 'tg-1',
          deliveryAddress: '123 Main St',
          items: [{ sku: 'UNKNOWN-SKU', quantity: 1 }],
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(salesService.create).not.toHaveBeenCalled();
    });
  });

  describe('lookupProductForCart', () => {
    it('returns a customer-safe {sku, name, unitPrice} line when the SKU resolves', async () => {
      productVariantsService.findBySkuInCompanyWithProduct.mockResolvedValue({
        sku: 'SKU-001',
        sellingPrice: '19.99',
        costPrice: '9.99',
        product: { name: 'Classic Denim Jacket' },
      } as never);

      const result = await service.lookupProductForCart('company-1', 'SKU-001');

      expect(result).toEqual({
        sku: 'SKU-001',
        name: 'Classic Denim Jacket',
        unitPrice: '19.99',
      });
      expect(result).not.toHaveProperty('costPrice');
    });

    it('returns null when the SKU does not resolve to a variant in this company', async () => {
      productVariantsService.findBySkuInCompanyWithProduct.mockResolvedValue(
        null,
      );

      await expect(
        service.lookupProductForCart('company-1', 'UNKNOWN-SKU'),
      ).resolves.toBeNull();
    });
  });

  describe('findTelegramUserIdForCustomer', () => {
    it('returns the telegramUserId for an ACTIVE link', async () => {
      linkRepository.findOne.mockResolvedValue({
        telegramUserId: 'tg-1',
        status: LinkStatus.Active,
      } as CustomerTelegramLink);

      await expect(
        service.findTelegramUserIdForCustomer('customer-1'),
      ).resolves.toBe('tg-1');
    });

    it('returns null rather than throwing when the customer has no Telegram link', async () => {
      linkRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findTelegramUserIdForCustomer('customer-1'),
      ).resolves.toBeNull();
    });
  });

  describe('getMyInfo', () => {
    it('returns the linked customer', async () => {
      const customer = buildCustomer();
      linkRepository.findOne.mockResolvedValue({
        telegramUserId: 'tg-1',
        status: LinkStatus.Active,
        customer,
      } as CustomerTelegramLink);

      await expect(service.getMyInfo('tg-1')).resolves.toBe(customer);
    });

    it('throws Forbidden for an unlinked Telegram user', async () => {
      linkRepository.findOne.mockResolvedValue(null);

      await expect(service.getMyInfo('tg-unlinked')).rejects.toMatchObject({
        errorCode: ErrorCode.Forbidden,
      });
    });
  });

  describe('updateMyInfo', () => {
    it('resolves the customer from telegramUserId and updates only name/phone', async () => {
      const customer = buildCustomer();
      linkRepository.findOne.mockResolvedValue({
        telegramUserId: 'tg-1',
        status: LinkStatus.Active,
        customer,
      } as CustomerTelegramLink);
      const updated = buildCustomer({ name: 'New Name', phone: '09999999999' });
      customersService.update.mockResolvedValue(updated);

      const result = await service.updateMyInfo('tg-1', {
        name: 'New Name',
        phone: '09999999999',
      });

      expect(customersService.update).toHaveBeenCalledWith(
        'customer-1',
        'company-1',
        { name: 'New Name', phone: '09999999999' },
      );
      expect(result).toBe(updated);
    });

    it('rejects when the Telegram user has no linked customer', async () => {
      linkRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateMyInfo('tg-unlinked', { name: 'X' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Forbidden });
      expect(customersService.update).not.toHaveBeenCalled();
    });
  });
});
