import { Repository } from 'typeorm';
import { CustomerAddressesService } from './customer-addresses.service';
import { CustomerAddress } from '../entities/customer-address.entity';
import { AddressType } from '../entities/address-type.enum';
import { CustomersService } from './customers.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('CustomerAddressesService', () => {
  let service: CustomerAddressesService;
  let addressRepository: jest.Mocked<
    Pick<
      Repository<CustomerAddress>,
      'find' | 'findOne' | 'create' | 'save' | 'update' | 'softRemove'
    >
  >;
  let customersService: jest.Mocked<
    Pick<CustomersService, 'findByIdInCompany'>
  >;

  const buildAddress = (
    overrides: Partial<CustomerAddress> = {},
  ): CustomerAddress =>
    ({
      id: 'addr-1',
      customerId: 'cust-1',
      label: AddressType.Other,
      recipientName: null,
      addressLine1: '123 Main St',
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      phone: null,
      isPrimary: false,
      ...overrides,
    }) as CustomerAddress;

  beforeEach(() => {
    addressRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softRemove: jest.fn(),
    };
    customersService = { findByIdInCompany: jest.fn() };

    service = new CustomerAddressesService(
      addressRepository as unknown as Repository<CustomerAddress>,
      customersService as unknown as CustomersService,
    );
  });

  describe('create', () => {
    it('creates an address after verifying the owning customer exists in-company', async () => {
      customersService.findByIdInCompany.mockResolvedValue({} as never);
      const created = buildAddress();
      addressRepository.create.mockReturnValue(created);
      addressRepository.save.mockResolvedValue(created);

      const result = await service.create('cust-1', 'company-a', {
        addressLine1: '123 Main St',
      });

      expect(customersService.findByIdInCompany).toHaveBeenCalledWith(
        'cust-1',
        'company-a',
      );
      expect(result).toBe(created);
    });

    it('propagates NotFound when the customerId does not belong to the resolved company (IDOR-safe)', async () => {
      customersService.findByIdInCompany.mockRejectedValue({
        errorCode: ErrorCode.NotFound,
      });

      await expect(
        service.create('cust-in-other-company', 'company-a', {
          addressLine1: '123 Main St',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('un-sets a previous primary address when a new one is created as primary', async () => {
      customersService.findByIdInCompany.mockResolvedValue({} as never);
      const created = buildAddress({ isPrimary: true });
      addressRepository.create.mockReturnValue(created);
      addressRepository.save.mockResolvedValue(created);

      await service.create('cust-1', 'company-a', {
        addressLine1: '123 Main St',
        isPrimary: true,
      });

      expect(addressRepository.update).toHaveBeenCalledWith(
        { customerId: 'cust-1', isPrimary: true },
        { isPrimary: false },
      );
    });
  });

  describe('findByIdInCompany — owner/company integrity', () => {
    it('throws NotFound when the address does not exist', async () => {
      addressRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('addr-missing', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('propagates NotFound when the owning customer is not in the resolved company', async () => {
      addressRepository.findOne.mockResolvedValue(buildAddress());
      customersService.findByIdInCompany.mockRejectedValue({
        errorCode: ErrorCode.NotFound,
      });

      await expect(
        service.findByIdInCompany('addr-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('remove', () => {
    it('soft-deletes the address', async () => {
      const address = buildAddress();
      addressRepository.findOne.mockResolvedValue(address);
      customersService.findByIdInCompany.mockResolvedValue({} as never);

      await service.remove('addr-1', 'company-a');

      expect(addressRepository.softRemove).toHaveBeenCalledWith(address);
    });
  });
});
