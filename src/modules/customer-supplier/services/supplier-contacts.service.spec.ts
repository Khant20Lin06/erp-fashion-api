import { Repository } from 'typeorm';
import { SupplierContactsService } from './supplier-contacts.service';
import { SupplierContact } from '../entities/supplier-contact.entity';
import { SuppliersService } from './suppliers.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('SupplierContactsService', () => {
  let service: SupplierContactsService;
  let contactRepository: jest.Mocked<
    Pick<
      Repository<SupplierContact>,
      'find' | 'findOne' | 'create' | 'save' | 'update' | 'softRemove'
    >
  >;
  let suppliersService: jest.Mocked<
    Pick<SuppliersService, 'findByIdInCompany'>
  >;

  const buildContact = (
    overrides: Partial<SupplierContact> = {},
  ): SupplierContact =>
    ({
      id: 'contact-1',
      supplierId: 'supp-1',
      name: 'John Smith',
      jobTitle: null,
      email: null,
      phone: null,
      mobile: null,
      isPrimary: false,
      ...overrides,
    }) as SupplierContact;

  beforeEach(() => {
    contactRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softRemove: jest.fn(),
    };
    suppliersService = { findByIdInCompany: jest.fn() };

    service = new SupplierContactsService(
      contactRepository as unknown as Repository<SupplierContact>,
      suppliersService as unknown as SuppliersService,
    );
  });

  describe('create', () => {
    it('creates a contact after verifying the owning supplier exists in-company', async () => {
      suppliersService.findByIdInCompany.mockResolvedValue({} as never);
      const created = buildContact();
      contactRepository.create.mockReturnValue(created);
      contactRepository.save.mockResolvedValue(created);

      const result = await service.create('supp-1', 'company-a', {
        name: 'John Smith',
      });

      expect(result).toBe(created);
    });

    it('propagates NotFound for a cross-company supplierId (IDOR-safe)', async () => {
      suppliersService.findByIdInCompany.mockRejectedValue({
        errorCode: ErrorCode.NotFound,
      });

      await expect(
        service.create('supp-other-company', 'company-a', {
          name: 'John Smith',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('remove', () => {
    it('soft-deletes the contact', async () => {
      const contact = buildContact();
      contactRepository.findOne.mockResolvedValue(contact);
      suppliersService.findByIdInCompany.mockResolvedValue({} as never);

      await service.remove('contact-1', 'company-a');

      expect(contactRepository.softRemove).toHaveBeenCalledWith(contact);
    });
  });
});
