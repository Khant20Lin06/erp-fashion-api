import { Repository } from 'typeorm';
import { CustomerContactsService } from './customer-contacts.service';
import { CustomerContact } from '../entities/customer-contact.entity';
import { CustomersService } from './customers.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('CustomerContactsService', () => {
  let service: CustomerContactsService;
  let contactRepository: jest.Mocked<
    Pick<
      Repository<CustomerContact>,
      'find' | 'findOne' | 'create' | 'save' | 'update' | 'softRemove'
    >
  >;
  let customersService: jest.Mocked<
    Pick<CustomersService, 'findByIdInCompany'>
  >;

  const buildContact = (
    overrides: Partial<CustomerContact> = {},
  ): CustomerContact =>
    ({
      id: 'contact-1',
      customerId: 'cust-1',
      name: 'Jane Doe',
      jobTitle: null,
      email: null,
      phone: null,
      mobile: null,
      isPrimary: false,
      ...overrides,
    }) as CustomerContact;

  beforeEach(() => {
    contactRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softRemove: jest.fn(),
    };
    customersService = { findByIdInCompany: jest.fn() };

    service = new CustomerContactsService(
      contactRepository as unknown as Repository<CustomerContact>,
      customersService as unknown as CustomersService,
    );
  });

  describe('create', () => {
    it('creates a contact after verifying the owning customer exists in-company', async () => {
      customersService.findByIdInCompany.mockResolvedValue({} as never);
      const created = buildContact();
      contactRepository.create.mockReturnValue(created);
      contactRepository.save.mockResolvedValue(created);

      const result = await service.create('cust-1', 'company-a', {
        name: 'Jane Doe',
      });

      expect(customersService.findByIdInCompany).toHaveBeenCalledWith(
        'cust-1',
        'company-a',
      );
      expect(result).toBe(created);
    });

    it('propagates NotFound for a cross-company customerId (IDOR-safe)', async () => {
      customersService.findByIdInCompany.mockRejectedValue({
        errorCode: ErrorCode.NotFound,
      });

      await expect(
        service.create('cust-other-company', 'company-a', { name: 'Jane Doe' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('un-sets a previous primary contact when a new one is created as primary', async () => {
      customersService.findByIdInCompany.mockResolvedValue({} as never);
      const created = buildContact({ isPrimary: true });
      contactRepository.create.mockReturnValue(created);
      contactRepository.save.mockResolvedValue(created);

      await service.create('cust-1', 'company-a', {
        name: 'Jane Doe',
        isPrimary: true,
      });

      expect(contactRepository.update).toHaveBeenCalledWith(
        { customerId: 'cust-1', isPrimary: true },
        { isPrimary: false },
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes the contact', async () => {
      const contact = buildContact();
      contactRepository.findOne.mockResolvedValue(contact);
      customersService.findByIdInCompany.mockResolvedValue({} as never);

      await service.remove('contact-1', 'company-a');

      expect(contactRepository.softRemove).toHaveBeenCalledWith(contact);
    });
  });
});
