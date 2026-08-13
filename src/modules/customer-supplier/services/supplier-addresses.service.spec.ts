import { Repository } from 'typeorm';
import { SupplierAddressesService } from './supplier-addresses.service';
import { SupplierAddress } from '../entities/supplier-address.entity';
import { AddressType } from '../entities/address-type.enum';
import { SuppliersService } from './suppliers.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('SupplierAddressesService', () => {
  let service: SupplierAddressesService;
  let addressRepository: jest.Mocked<
    Pick<
      Repository<SupplierAddress>,
      'find' | 'findOne' | 'create' | 'save' | 'update' | 'softRemove'
    >
  >;
  let suppliersService: jest.Mocked<
    Pick<SuppliersService, 'findByIdInCompany'>
  >;

  const buildAddress = (
    overrides: Partial<SupplierAddress> = {},
  ): SupplierAddress =>
    ({
      id: 'addr-1',
      supplierId: 'supp-1',
      label: AddressType.Other,
      recipientName: null,
      addressLine1: '456 Industrial Rd',
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      phone: null,
      isPrimary: false,
      ...overrides,
    }) as SupplierAddress;

  beforeEach(() => {
    addressRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softRemove: jest.fn(),
    };
    suppliersService = { findByIdInCompany: jest.fn() };

    service = new SupplierAddressesService(
      addressRepository as unknown as Repository<SupplierAddress>,
      suppliersService as unknown as SuppliersService,
    );
  });

  describe('create', () => {
    it('creates an address after verifying the owning supplier exists in-company', async () => {
      suppliersService.findByIdInCompany.mockResolvedValue({} as never);
      const created = buildAddress();
      addressRepository.create.mockReturnValue(created);
      addressRepository.save.mockResolvedValue(created);

      const result = await service.create('supp-1', 'company-a', {
        addressLine1: '456 Industrial Rd',
      });

      expect(suppliersService.findByIdInCompany).toHaveBeenCalledWith(
        'supp-1',
        'company-a',
      );
      expect(result).toBe(created);
    });

    it('propagates NotFound for a cross-company supplierId (IDOR-safe)', async () => {
      suppliersService.findByIdInCompany.mockRejectedValue({
        errorCode: ErrorCode.NotFound,
      });

      await expect(
        service.create('supp-other-company', 'company-a', {
          addressLine1: '456 Industrial Rd',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('remove', () => {
    it('soft-deletes the address', async () => {
      const address = buildAddress();
      addressRepository.findOne.mockResolvedValue(address);
      suppliersService.findByIdInCompany.mockResolvedValue({} as never);

      await service.remove('addr-1', 'company-a');

      expect(addressRepository.softRemove).toHaveBeenCalledWith(address);
    });
  });
});
