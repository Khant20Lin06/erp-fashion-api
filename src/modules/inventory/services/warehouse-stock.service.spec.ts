import { Repository, SelectQueryBuilder } from 'typeorm';
import { WarehouseStockService } from './warehouse-stock.service';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { toWarehouseStockResponseDto } from '../dto/warehouse-stock-response.dto';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('WarehouseStockService', () => {
  let service: WarehouseStockService;
  let warehouseStockRepository: jest.Mocked<
    Pick<Repository<WarehouseStock>, 'createQueryBuilder'>
  >;
  let listQueryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<WarehouseStock>,
      | 'innerJoin'
      | 'where'
      | 'andWhere'
      | 'orderBy'
      | 'skip'
      | 'take'
      | 'getManyAndCount'
      | 'getOne'
    >
  >;

  beforeEach(() => {
    listQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getOne: jest.fn(),
    };
    warehouseStockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(listQueryBuilder),
    };

    service = new WarehouseStockService(
      warehouseStockRepository as unknown as Repository<WarehouseStock>,
    );
  });

  describe('findAll', () => {
    it('scopes to the resolved company via a join through warehouse.companyId', async () => {
      listQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll('company-a', {} as never);

      expect(listQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'stock.warehouse',
        'warehouse',
      );
      expect(listQueryBuilder.where).toHaveBeenCalledWith(
        'warehouse.companyId = :companyId',
        { companyId: 'company-a' },
      );
    });

    it('computes availableQuantity correctly at the DTO layer (onHand - reserved)', () => {
      // Exercised indirectly via toWarehouseStockResponseDto — verified
      // here directly against the pure function contract.
      const entity = {
        id: 's-1',
        warehouseId: 'wh-1',
        productVariantId: 'v-1',
        onHandQuantity: 10,
        reservedQuantity: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as WarehouseStock;

      const dto = toWarehouseStockResponseDto(entity);
      expect(dto.availableQuantity).toBe(7);
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a warehouse stock row belonging to a different company', async () => {
      listQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('stock-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('returns the row when it belongs to the resolved company', async () => {
      const row = { id: 'stock-1' } as WarehouseStock;
      listQueryBuilder.getOne.mockResolvedValue(row);

      const result = await service.findByIdInCompany('stock-1', 'company-a');
      expect(result).toBe(row);
    });
  });
});
