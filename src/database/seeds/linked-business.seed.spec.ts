import { AppDataSource } from '../data-source';
import { Company } from '../../modules/organization/entities/company.entity';
import { Uom } from '../../modules/uom/entities/uom.entity';
import { ProductVariant } from '../../modules/products/entities/product-variant.entity';
import { ProductVariantUom } from '../../modules/products/entities/product-variant-uom.entity';
import { ProductVariantUomUsageType } from '../../modules/products/entities/product-variant-uom-usage-type.enum';
import { PriceList } from '../../modules/products/entities/price-list.entity';
import { PriceListItem } from '../../modules/products/entities/price-list-item.entity';

describe('linked-business seed pricing linkage', () => {
  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('provides company-scoped UOM, variant-UOM, and price-list item links for the linked business seed', async () => {
    const companyRepo = AppDataSource.getRepository(Company);
    const uomRepo = AppDataSource.getRepository(Uom);
    const variantRepo = AppDataSource.getRepository(ProductVariant);
    const variantUomRepo = AppDataSource.getRepository(ProductVariantUom);
    const priceListRepo = AppDataSource.getRepository(PriceList);
    const priceListItemRepo = AppDataSource.getRepository(PriceListItem);

    const company = await companyRepo.findOne({
      where: { code: 'FASHION-ENT-MAIN' },
    });
    expect(company).toBeTruthy();
    if (!company) {
      return;
    }

    const [uomCount, baseUomVariantCount, salesVariantUomCount] = await Promise.all([
      uomRepo.count({ where: { companyId: company.id, isActive: true } }),
      variantRepo.count({
        where: {
          companyId: company.id,
        },
      }),
      variantUomRepo.count({
        where: {
          companyId: company.id,
          isActive: true,
          usageType: ProductVariantUomUsageType.Sales,
        },
      }),
    ]);

    expect(uomCount).toBeGreaterThanOrEqual(4);

    const variantWithBaseUom = await variantRepo.findOne({
      where: {
        companyId: company.id,
      },
      order: { createdAt: 'ASC' },
    });
    expect(variantWithBaseUom?.baseUomId).toBeTruthy();

    expect(salesVariantUomCount).toBeGreaterThan(0);

    const retailPriceList = await priceListRepo.findOne({
      where: {
        companyId: company.id,
        code: 'PL-RETAIL-USD',
      },
    });
    expect(retailPriceList).toBeTruthy();
    if (!retailPriceList) {
      return;
    }

    const linkedPriceRowCount = await priceListItemRepo
      .createQueryBuilder('item')
      .where('item.companyId = :companyId', { companyId: company.id })
      .andWhere('item.priceListId = :priceListId', { priceListId: retailPriceList.id })
      .andWhere('item.uomId IS NOT NULL')
      .getCount();

    expect(linkedPriceRowCount).toBeGreaterThan(0);
    expect(baseUomVariantCount).toBeGreaterThan(0);
  });
});
