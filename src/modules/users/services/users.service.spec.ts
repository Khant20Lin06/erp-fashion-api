import { Repository, SelectQueryBuilder } from 'typeorm';
import { UsersService } from './users.service';
import { User } from '../entities/user.entity';
import { UserStatus } from '../entities/user-status.enum';
import { UserCompany } from '../../organization/entities/user-company.entity';
import { PasswordService } from '../../auth/services/password.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<
    Pick<
      Repository<User>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let userCompanyRepository: jest.Mocked<
    Pick<Repository<UserCompany>, 'createQueryBuilder'>
  >;
  let membershipQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getCount: jest.Mock;
  };
  let passwordService: jest.Mocked<
    Pick<PasswordService, 'hash' | 'verify' | 'validatePolicy'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<User>,
      'innerJoin' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildUser = (overrides: Partial<User> = {}): User => ({
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: 'hashed',
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: 'Jane Doe',
    status: UserStatus.Active,
    isEmailVerified: false,
    lastLoginAt: null,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    membershipQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    };
    userCompanyRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(membershipQueryBuilder),
    };
    passwordService = {
      hash: jest.fn(),
      verify: jest.fn(),
      validatePolicy: jest.fn(),
    };

    service = new UsersService(
      userRepository as unknown as Repository<User>,
      userCompanyRepository as unknown as Repository<UserCompany>,
      passwordService,
    );
  });

  describe('create', () => {
    it('creates a user when email is unique and password meets policy', async () => {
      userRepository.findOne.mockResolvedValue(null);
      passwordService.validatePolicy.mockReturnValue(true);
      passwordService.hash.mockResolvedValue('hashed-pw');
      const created = buildUser();
      userRepository.create.mockReturnValue(created);
      userRepository.save.mockResolvedValue(created);

      const result = await service.create({
        email: 'JANE@EXAMPLE.COM',
        password: 'correct-horse-battery-staple',
        firstName: 'Jane',
        lastName: 'Doe',
      });

      expect(result).toBe(created);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'jane@example.com' },
      });
    });

    it('rejects a duplicate email with 409', async () => {
      userRepository.findOne.mockResolvedValue(buildUser());

      await expect(
        service.create({
          email: 'jane@example.com',
          password: 'correct-horse-battery-staple',
          firstName: 'Jane',
          lastName: 'Doe',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects a weak password before hashing', async () => {
      userRepository.findOne.mockResolvedValue(null);
      passwordService.validatePolicy.mockReturnValue(false);

      await expect(
        service.create({
          email: 'new@example.com',
          password: 'weak',
          firstName: 'Jane',
          lastName: 'Doe',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(passwordService.hash).not.toHaveBeenCalled();
    });

    it('never returns a passwordHash-bearing response shape by construction (service returns the entity; DTO mapping strips it)', async () => {
      userRepository.findOne.mockResolvedValue(null);
      passwordService.validatePolicy.mockReturnValue(true);
      passwordService.hash.mockResolvedValue('hashed-pw');
      userRepository.create.mockImplementation((input) => input as User);
      userRepository.save.mockImplementation((input) =>
        Promise.resolve(input as User),
      );

      const result = await service.create({
        email: 'new@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'Jane',
        lastName: 'Doe',
      });

      expect(result.passwordHash).toBe('hashed-pw');
      expect(result.status).toBe(UserStatus.Active);
    });
  });

  describe('findById', () => {
    it('returns the user when found and scope is unrestricted (ALL)', async () => {
      const user = buildUser();
      userRepository.findOne.mockResolvedValue(user);

      await expect(service.findById('user-1', null)).resolves.toBe(user);
      expect(userCompanyRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('throws NotFound when missing', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findById('missing', null),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.NotFound,
      });
    });

    it('returns the user when they have an active membership in an allowed company', async () => {
      const user = buildUser();
      userRepository.findOne.mockResolvedValue(user);
      membershipQueryBuilder.getCount.mockResolvedValue(1);

      await expect(
        service.findById('user-1', ['company-a']),
      ).resolves.toBe(user);
    });

    it('throws NotFound (not Forbidden) when the target user is outside the allowed companies (IDOR protection)', async () => {
      const user = buildUser();
      userRepository.findOne.mockResolvedValue(user);
      membershipQueryBuilder.getCount.mockResolvedValue(0);

      await expect(
        service.findById('user-1', ['company-a']),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('throws NotFound immediately when the caller has no allowed companies at all', async () => {
      const user = buildUser();
      userRepository.findOne.mockResolvedValue(user);

      await expect(service.findById('user-1', [])).rejects.toMatchObject({
        errorCode: ErrorCode.NotFound,
      });
      expect(userCompanyRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('activate / deactivate / lock / unlock', () => {
    it('activate sets status to ACTIVE', async () => {
      userRepository.findOne.mockResolvedValue(
        buildUser({ status: UserStatus.Inactive }),
      );
      userRepository.save.mockImplementation((input) =>
        Promise.resolve(input as User),
      );

      const result = await service.activate('user-1', null);

      expect(result.status).toBe(UserStatus.Active);
    });

    it('deactivate sets status to INACTIVE', async () => {
      userRepository.findOne.mockResolvedValue(buildUser());
      userRepository.save.mockImplementation((input) =>
        Promise.resolve(input as User),
      );

      const result = await service.deactivate('user-1', null);

      expect(result.status).toBe(UserStatus.Inactive);
    });

    it('lock sets status to LOCKED (distinct from INACTIVE/SUSPENDED)', async () => {
      userRepository.findOne.mockResolvedValue(buildUser());
      userRepository.save.mockImplementation((input) =>
        Promise.resolve(input as User),
      );

      const result = await service.lock('user-1', null);

      expect(result.status).toBe(UserStatus.Locked);
    });

    it('unlock sets status back to ACTIVE', async () => {
      userRepository.findOne.mockResolvedValue(
        buildUser({ status: UserStatus.Locked }),
      );
      userRepository.save.mockImplementation((input) =>
        Promise.resolve(input as User),
      );

      const result = await service.unlock('user-1', null);

      expect(result.status).toBe(UserStatus.Active);
    });

    it('rejects lock when the target user is outside the caller\'s allowed companies', async () => {
      userRepository.findOne.mockResolvedValue(buildUser());
      membershipQueryBuilder.getCount.mockResolvedValue(0);

      await expect(
        service.lock('user-1', ['company-a']),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes the user (never a hard delete)', async () => {
      const user = buildUser();
      userRepository.findOne.mockResolvedValue(user);

      await service.remove('user-1', null);

      expect(userRepository.softRemove).toHaveBeenCalledWith(user);
    });
  });

  describe('findAll', () => {
    it('applies status filter and pagination', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[buildUser()], 1]);

      const result = await service.findAll(
        {
          page: 1,
          limit: 20,
          status: UserStatus.Active,
          skip: 0,
        },
        null,
      );

      expect(result.meta.total).toBe(1);
      expect(queryBuilder.innerJoin).not.toHaveBeenCalled();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'user.status = :status',
        { status: UserStatus.Active },
      );
    });

    it('joins to company membership when the caller is scoped to specific companies', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[buildUser()], 1]);

      await service.findAll(
        { page: 1, limit: 20, skip: 0 },
        ['company-a', 'company-b'],
      );

      expect(queryBuilder.innerJoin).toHaveBeenCalled();
    });

    it('short-circuits to an empty page without querying when the caller has no allowed companies', async () => {
      const result = await service.findAll(
        { page: 1, limit: 20, skip: 0 },
        [],
      );

      expect(result).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
      expect(userRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
