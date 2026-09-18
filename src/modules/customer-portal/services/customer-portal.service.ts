import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { CustomerTelegramLink } from '../entities/customer-telegram-link.entity';
import { LinkStatus } from '../entities/link-status.enum';
import { TelegramLinkOtp } from '../entities/telegram-link-otp.entity';
import { generateOtpCode, hashOtpCode } from '../utils/otp.util';
import { Customer } from '../../customer-supplier/entities/customer.entity';
import { CustomersService } from '../../customer-supplier/services/customers.service';
import { CompaniesService } from '../../organization/services/companies.service';
import { Sale } from '../../sales/entities/sale.entity';
import { SalesService } from '../../sales/services/sales.service';
import { CreateSaleDto } from '../../sales/dto/create-sale.dto';
import { ProductVariantsService } from '../../products/services/product-variants.service';
import { OnlineOrdersService } from '../../online-orders/services/online-orders.service';
import { OnlineOrder } from '../../online-orders/entities/online-order.entity';
import { OnlineOrderSource } from '../../online-orders/entities/online-order-source.enum';
import { CreateCustomerOrderDto } from '../dto/create-customer-order.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

const OTP_EXPIRES_IN_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

/**
 * Backs the Customer Service Bot's identity flow: a Telegram user proves
 * they own a phone number (OTP sent back through the same Telegram chat —
 * see docs/... n8n workflow, no SMS provider exists in this codebase) and
 * is then linked to exactly one Customer record. Every other method here
 * (getLinkedCustomerOrThrow, createOrder) resolves the caller's Customer
 * from telegramUserId server-side — never from a client-supplied
 * customerId/phone (docs/SECURITY_RULES.md #12/#13).
 */
@Injectable()
export class CustomerPortalService {
  constructor(
    @InjectRepository(CustomerTelegramLink)
    private readonly linkRepository: Repository<CustomerTelegramLink>,
    @InjectRepository(TelegramLinkOtp)
    private readonly otpRepository: Repository<TelegramLinkOtp>,
    private readonly customersService: CustomersService,
    private readonly companiesService: CompaniesService,
    private readonly salesService: SalesService,
    private readonly productVariantsService: ProductVariantsService,
    private readonly onlineOrdersService: OnlineOrdersService,
  ) {}

  /**
   * Starts (or restarts) verification for a Telegram user claiming a phone
   * number. Returns the raw OTP code — the caller (the bot integration
   * layer) is responsible for sending it back to that same Telegram chat
   * immediately and MUST NOT log it (docs/SECURITY_RULES.md #35/#43).
   * Any previous unconsumed OTP for this telegramUserId is superseded
   * (only the newest one can be consumed) rather than allowing multiple
   * concurrently-valid codes.
   */
  async requestLink(
    telegramUserId: string,
    companyId: string,
    phone: string,
  ): Promise<{ code: string; expiresAt: Date }> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    await this.otpRepository.update(
      { telegramUserId, consumedAt: IsNull() },
      { consumedAt: new Date() },
    );

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60_000);

    const otp = this.otpRepository.create({
      telegramUserId,
      phone: phone.trim(),
      companyId,
      codeHash: hashOtpCode(code),
      attemptCount: 0,
      expiresAt,
      consumedAt: null,
    });
    await this.otpRepository.save(otp);

    // Returned to the CONTROLLER layer only, which hands it to the n8n
    // bot to relay over Telegram — never persisted or logged in plaintext
    // anywhere past this point.
    return { code, expiresAt };
  }

  /**
   * Verifies the OTP and links telegramUserId to a Customer, creating a
   * minimal Customer record if none exists yet for this phone number
   * (first-time Telegram customer — no prior ERP/POS record). Upserts the
   * single row for this telegramUserId (unique index) rather than
   * inserting a new one — a re-link always supersedes in place.
   */
  async verifyLinkAndGetCustomer(
    telegramUserId: string,
    code: string,
  ): Promise<Customer> {
    const otp = await this.otpRepository.findOne({
      where: { telegramUserId, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (!otp) {
      throw new AppException(
        ErrorCode.ValidationError,
        'No pending verification for this Telegram account — request a new code',
      );
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Verification code has expired',
      );
    }

    if (otp.attemptCount >= OTP_MAX_ATTEMPTS) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Too many incorrect attempts — request a new code',
      );
    }

    const matches = hashOtpCode(code) === otp.codeHash;
    if (!matches) {
      otp.attemptCount += 1;
      await this.otpRepository.save(otp);
      throw new AppException(
        ErrorCode.ValidationError,
        'Incorrect verification code',
      );
    }

    otp.consumedAt = new Date();
    await this.otpRepository.save(otp);

    const customer = await this.findOrCreateCustomerByPhone(
      otp.companyId,
      otp.phone,
    );

    const existingLink = await this.linkRepository.findOne({
      where: { telegramUserId },
    });

    if (existingLink) {
      existingLink.customerId = customer.id;
      existingLink.status = LinkStatus.Active;
      existingLink.linkedAt = new Date();
      existingLink.revokedAt = null;
      await this.linkRepository.save(existingLink);
    } else {
      const link = this.linkRepository.create({
        telegramUserId,
        customerId: customer.id,
        status: LinkStatus.Active,
        linkedAt: new Date(),
        revokedAt: null,
      });
      await this.linkRepository.save(link);
    }

    return customer;
  }

  /**
   * The one place a Telegram user's identity resolves to a Customer.
   * Every bot-facing endpoint that needs "who is this" calls this instead
   * of trusting a client-supplied customerId.
   */
  async getLinkedCustomerOrThrow(telegramUserId: string): Promise<Customer> {
    const link = await this.linkRepository.findOne({
      where: { telegramUserId, status: LinkStatus.Active },
      relations: { customer: true },
    });

    if (!link) {
      throw new AppException(
        ErrorCode.Forbidden,
        'This Telegram account is not linked to a customer — verify your phone number first',
      );
    }

    return link.customer;
  }

  /**
   * Resolves the ACTIVE Telegram link for a Customer, if one exists — the
   * Customer Order Bot's own path to "which Telegram chat do I message
   * when this order's status changes." Returns null rather than throwing
   * when there's no link (a Sale can exist for a Customer who was never
   * linked via Telegram, e.g. a walk-in order entered by staff) — the
   * caller decides whether that's an error or just "nothing to notify."
   */
  async findTelegramUserIdForCustomer(
    customerId: string,
  ): Promise<string | null> {
    const link = await this.linkRepository.findOne({
      where: { customerId, status: LinkStatus.Active },
    });
    return link?.telegramUserId ?? null;
  }

  async getMyInfo(telegramUserId: string): Promise<Customer> {
    return this.getLinkedCustomerOrThrow(telegramUserId);
  }

  /**
   * Resolves a single SKU to a customer-safe {name, sku, unitPrice} line —
   * backs the Customer Service Bot's cart display (see
   * customer-service-bot-workflow.json's "Look Up Each SKU" node), never
   * the admin-facing ProductsService.findAll()/ProductVariantsService's own
   * column set (costPrice/margin never leave this method, same rationale
   * as ProductLookupTool's own docblock). Does not require an existing
   * Telegram link — a customer can build a cart before verifying their
   * phone, and verification only gates actually placing the order.
   */
  async lookupProductForCart(
    companyId: string,
    sku: string,
  ): Promise<{ sku: string; name: string; unitPrice: string } | null> {
    const variant =
      await this.productVariantsService.findBySkuInCompanyWithProduct(
        companyId,
        sku,
      );
    if (!variant) {
      return null;
    }
    return {
      sku: variant.sku,
      name: variant.product.name,
      unitPrice: variant.sellingPrice,
    };
  }

  /**
   * Lets a linked customer correct their own name/phone before submitting
   * an order — narrower than CustomersService.update's full admin DTO
   * (see UpdateMyInfoDto's own docblock). Resolves the target Customer
   * from telegramUserId, never a client-supplied customerId.
   */
  async updateMyInfo(
    telegramUserId: string,
    fields: { name?: string; phone?: string },
  ): Promise<Customer> {
    const customer = await this.getLinkedCustomerOrThrow(telegramUserId);
    return this.customersService.update(customer.id, customer.companyId, {
      name: fields.name,
      phone: fields.phone,
    });
  }

  /**
   * Creates a DRAFT sale for the caller's own (server-resolved) Customer,
   * then a linked OnlineOrder row recording the delivery address and
   * Telegram identity (see OnlineOrder's own docblock for why this is a
   * separate entity/table, never a Sale field).
   *
   * These are two sequential writes, NOT one shared transaction:
   * SalesService.create() commits its own transaction internally (a
   * locked Sale-module boundary this method does not reach into), so the
   * OnlineOrder row is created only after the Sale has fully committed.
   * With idempotencyKey, the Sale stores the scoped key and request hash
   * in its own transaction. If OnlineOrder fails, replay finds that Sale
   * before resolving current catalog data, then recovers its metadata.
   */
  async createOrder(
    botUserId: string,
    dto: CreateCustomerOrderDto,
  ): Promise<{ sale: Sale; onlineOrder: OnlineOrder }> {
    const customer = await this.getLinkedCustomerOrThrow(dto.telegramUserId);
    if (dto.companyId && dto.companyId !== customer.companyId) {
      throw new AppException(
        ErrorCode.Conflict,
        'Linked customer belongs to a different company',
      );
    }
    const hash = (value: unknown) =>
      createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const creation = dto.idempotencyKey
      ? {
          key: hash([
            customer.companyId,
            botUserId,
            dto.telegramUserId,
            dto.idempotencyKey,
          ]),
          hash: hash([
            customer.id,
            dto.telegramUserId,
            dto.deliveryAddress,
            dto.notes ?? null,
            dto.items.map((item) => [item.sku, item.quantity]),
          ]),
        }
      : undefined;
    if (creation) {
      const sale = await this.salesService.findByCreationKey(
        customer.companyId,
        creation,
      );
      if (sale)
        return {
          sale,
          onlineOrder: await this.createOnlineOrder(sale.id, customer, dto),
        };
    }
    const company = await this.companiesService.findActiveByIdOrNull(
      customer.companyId,
    );
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        "Linked customer's company is no longer active",
      );
    }

    const activePriceLists =
      (await this.salesService.listActivePriceLists?.(customer.companyId)) ?? [];
    let defaultRetailPriceListId: string | undefined = undefined;
    if (activePriceLists.length === 1) {
      defaultRetailPriceListId = activePriceLists[0].id;
    } else if (activePriceLists.length > 1) {
      const retail =
        activePriceLists.find(
          (p) =>
            p.code.toUpperCase().includes('RETAIL') ||
            p.name.toLowerCase().includes('retail'),
        ) ||
        activePriceLists.find((p) => p.currency === company.baseCurrency) ||
        activePriceLists[0];
      defaultRetailPriceListId = retail?.id;
    }

    const resolvedItems = await Promise.all(
      dto.items.map(async (item) => {
        const variant = await this.productVariantsService.findBySkuInCompany(
          customer.companyId,
          item.sku,
        );
        if (!variant) {
          throw new AppException(
            ErrorCode.ValidationError,
            `No product found for SKU "${item.sku}"`,
          );
        }
        return {
          productVariantId: variant.id,
          quantity: item.quantity,
          ...(defaultRetailPriceListId ? { priceListId: defaultRetailPriceListId } : {}),
        };
      }),
    );

    const createSaleDto: CreateSaleDto = {
      customerId: customer.id,
      currency: company.baseCurrency,
      notes: dto.notes,
      items: resolvedItems,
    };

    // botUserId is the CUSTOMER_SERVICE_BOT service account's real User
    // id (resolved by the controller from its own authenticated session)
    // — Sale.createdBy then genuinely records "this bot placed the
    // order," not a fabricated/null identity.
    const sale = await this.salesService.create(
      customer.companyId,
      botUserId,
      createSaleDto,
      ...(creation ? ([creation] as const) : []),
    );

    return {
      sale,
      onlineOrder: await this.createOnlineOrder(sale.id, customer, dto),
    };
  }

  private createOnlineOrder(
    saleId: string,
    customer: Customer,
    dto: CreateCustomerOrderDto,
  ): Promise<OnlineOrder> {
    return this.onlineOrdersService.createForSale({
      companyId: customer.companyId,
      saleId,
      customerId: customer.id,
      source: OnlineOrderSource.Telegram,
      telegramUserId: dto.telegramUserId,
      telegramUsername: dto.telegramUsername ?? null,
      deliveryAddress: dto.deliveryAddress,
    });
  }

  private async findOrCreateCustomerByPhone(
    companyId: string,
    phone: string,
  ): Promise<Customer> {
    const existing = await this.customersService.findActiveByPhone(
      companyId,
      phone,
    );
    if (existing) {
      return existing;
    }

    return this.customersService.create(companyId, {
      customerCode: this.generateBotCustomerCode(),
      name: `Telegram Customer ${phone}`,
      phone,
    });
  }

  private generateBotCustomerCode(): string {
    return `TGB-${randomBytes(4).toString('hex').toUpperCase()}`;
  }
}
