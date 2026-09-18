import { Repository } from 'typeorm';
import { ProductLookupTool } from './product-lookup.tool';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { ProductVariantAttribute } from '../../products/entities/product-variant-attribute.entity';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { AiToolContext } from './ai-tool.interface';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('ProductLookupTool', () => {
  let tool: ProductLookupTool;
  let variantRepository: jest.Mocked<Pick<Repository<ProductVariant>, 'createQueryBuilder'>>;
  let attributeRepository: jest.Mocked<Pick<Repository<ProductVariantAttribute>, 'find'>>;
  let queryBuilder: {
    innerJoin: jest.Mock;
    leftJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    groupBy: jest.Mock;
    addGroupBy: jest.Mock;
    select: jest.Mock;
    addSelect: jest.Mock;
    limit: jest.Mock;
    getRawMany: jest.Mock;
  };

  const context: AiToolContext = {
    user: { id: 'user-1' } as never,
    companyId: 'company-1',
    branchId: undefined,
    allowedBranchIds: null,
  };

  beforeEach(() => {
    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };
    variantRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    attributeRepository = { find: jest.fn().mockResolvedValue([]) };

    tool = new ProductLookupTool(
      variantRepository as unknown as Repository<ProductVariant>,
      attributeRepository as unknown as Repository<ProductVariantAttribute>,
    );
  });

  it('rejects a missing query argument before touching the database', async () => {
    await expect(tool.execute(context, {})).rejects.toMatchObject({
      errorCode: ErrorCode.ValidationError,
    });
    expect(variantRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('never selects costPrice — only customer-safe columns', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    await tool.execute(context, { query: 'shirt' });

    const selectedColumns = queryBuilder.select.mock.calls[0][0] as string[];
    expect(selectedColumns.join(' ')).not.toMatch(/costPrice/i);
    expect(selectedColumns.join(' ')).toMatch(/sellingPrice/i);
  });

  it('returns an empty array and skips the attributes query when nothing matches', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    const result = await tool.execute(context, { query: 'nonexistent' });

    expect(result).toEqual([]);
    expect(attributeRepository.find).not.toHaveBeenCalled();
  });

  it('maps a matched row to a customer-safe result with stock status derived from summed quantity', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        productName: 'Organic Cotton T-Shirt',
        productCode: 'OCT-001',
        variantId: 'variant-1',
        sku: 'OCT-001-BLK-M',
        sellingPrice: '25000.00',
        status: ProductVariantStatus.Active,
        onHandQuantity: '12',
      },
    ]);
    attributeRepository.find.mockResolvedValue([
      {
        variantId: 'variant-1',
        option: { value: 'Black' },
      } as never,
      {
        variantId: 'variant-1',
        option: { value: 'M' },
      } as never,
    ]);

    const result = await tool.execute(context, { query: 'Organic Cotton' });

    expect(result).toEqual([
      {
        name: 'Organic Cotton T-Shirt',
        sku: 'OCT-001-BLK-M',
        price: '25000.00',
        inStock: true,
        quantityAvailable: 12,
        variant: 'Black, M',
      },
    ]);
  });

  it('marks a zero-quantity variant as out of stock rather than omitting it', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        productName: 'Denim Jacket',
        productCode: 'DJ-002',
        variantId: 'variant-2',
        sku: 'DJ-002-BLU-L',
        sellingPrice: '55000.00',
        status: ProductVariantStatus.Active,
        onHandQuantity: '0',
      },
    ]);

    const result = await tool.execute(context, { query: 'Denim Jacket' });

    expect(result[0].inStock).toBe(false);
    expect(result[0].quantityAvailable).toBe(0);
  });

  it('scopes the query to the caller\'s companyId, never a client-supplied one', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    await tool.execute(context, { query: 'shirt' });

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'variant.companyId = :companyId',
      { companyId: 'company-1' },
    );
  });

  it('only matches ACTIVE variants', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    await tool.execute(context, { query: 'shirt' });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('variant.status = :status', {
      status: ProductVariantStatus.Active,
    });
  });

  it('scopes stock to a specific warehouse when warehouseId is given', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    await tool.execute(context, { query: 'shirt', warehouseId: '8b1e6a90-3f5c-4a2e-9c1b-7d0a2f4e6c88' });

    const leftJoinArgs = queryBuilder.leftJoin.mock.calls[0];
    expect(leftJoinArgs[2]).toContain('stock.warehouse_id = :warehouseId');
    expect(leftJoinArgs[3]).toEqual({
      warehouseId: '8b1e6a90-3f5c-4a2e-9c1b-7d0a2f4e6c88',
    });
  });
});
