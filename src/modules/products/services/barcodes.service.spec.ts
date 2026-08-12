import { Repository } from 'typeorm';
import { BarcodesService } from './barcodes.service';
import { ProductVariantBarcode } from '../entities/product-variant-barcode.entity';
import { BarcodeStatus } from '../entities/barcode-status.enum';
import { ProductVariantsService } from './product-variants.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('BarcodesService', () => {
  let service: BarcodesService;
  let barcodeRepository: jest.Mocked<
    Pick<
      Repository<ProductVariantBarcode>,
      'find' | 'findOne' | 'create' | 'save' | 'softRemove'
    >
  >;
  let productVariantsService: jest.Mocked<
    Pick<ProductVariantsService, 'findByIdInCompany'>
  >;

  const buildBarcode = (
    overrides: Partial<ProductVariantBarcode> = {},
  ): ProductVariantBarcode =>
    ({
      id: 'barcode-1',
      variantId: 'variant-1',
      companyId: 'company-a',
      barcode: '890001000001',
      status: BarcodeStatus.Active,
      ...overrides,
    }) as ProductVariantBarcode;

  beforeEach(() => {
    barcodeRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };
    productVariantsService = {
      findByIdInCompany: jest.fn().mockResolvedValue({ id: 'variant-1' }),
    };

    service = new BarcodesService(
      barcodeRepository as unknown as Repository<ProductVariantBarcode>,
      productVariantsService as unknown as ProductVariantsService,
    );
  });

  describe('create', () => {
    it('creates a barcode for an existing variant', async () => {
      barcodeRepository.findOne.mockResolvedValue(null);
      const created = buildBarcode();
      barcodeRepository.create.mockReturnValue(created);
      barcodeRepository.save.mockResolvedValue(created);

      const result = await service.create('variant-1', 'company-a', {
        barcode: '890001000001',
      });

      expect(result).toBe(created);
      expect(productVariantsService.findByIdInCompany).toHaveBeenCalledWith(
        'variant-1',
        'company-a',
      );
    });

    it('rejects a duplicate barcode within the same company (409)', async () => {
      barcodeRepository.findOne.mockResolvedValue(buildBarcode());

      await expect(
        service.create('variant-1', 'company-a', { barcode: '890001000001' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('allows the same barcode text across two different companies (scoped uniqueness)', async () => {
      barcodeRepository.findOne.mockResolvedValue(null);
      const created = buildBarcode({ id: 'barcode-2', companyId: 'company-b' });
      barcodeRepository.create.mockReturnValue(created);
      barcodeRepository.save.mockResolvedValue(created);

      const result = await service.create('variant-1', 'company-b', {
        barcode: '890001000001',
      });

      expect(result.companyId).toBe('company-b');
    });
  });

  describe('findAllForVariant', () => {
    it('supports multiple barcodes per variant', async () => {
      barcodeRepository.find.mockResolvedValue([
        buildBarcode({ id: 'barcode-1', barcode: '111' }),
        buildBarcode({ id: 'barcode-2', barcode: '222' }),
      ]);

      const result = await service.findAllForVariant('variant-1', 'company-a');

      expect(result).toHaveLength(2);
    });
  });

  describe('findByIdInCompany — cross-company isolation (IDOR)', () => {
    it('throws NotFound (not Forbidden) for a barcode in a different company', async () => {
      barcodeRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('barcode-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('activate / deactivate', () => {
    it('deactivate sets status to INACTIVE', async () => {
      barcodeRepository.findOne.mockResolvedValue(buildBarcode());
      barcodeRepository.save.mockImplementation((input) =>
        Promise.resolve(input as ProductVariantBarcode),
      );

      const result = await service.deactivate('barcode-1', 'company-a');

      expect(result.status).toBe(BarcodeStatus.Inactive);
    });
  });

  describe('remove', () => {
    it('soft-deletes the barcode', async () => {
      const barcode = buildBarcode();
      barcodeRepository.findOne.mockResolvedValue(barcode);

      await service.remove('barcode-1', 'company-a');

      expect(barcodeRepository.softRemove).toHaveBeenCalledWith(barcode);
    });
  });
});
