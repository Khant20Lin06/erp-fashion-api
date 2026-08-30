import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserStatus } from '../entities/user-status.enum';
import { UserCompany } from '../../organization/entities/user-company.entity';
import { MembershipStatus } from '../../organization/entities/membership-status.enum';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ListUsersDto } from '../dto/list-users.dto';
import { PasswordService } from '../../auth/services/password.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

/**
 * allowedCompanyIds mirrors DataScopeService.resolveAllowedCompanyIds():
 * null means DataScope.All (unrestricted), a string[] is the exact set of
 * companies the caller may operate against (possibly empty -> no access).
 * Every operation that reads or mutates a specific user must be scoped by
 * this so a Company-scoped `users.*` grant cannot reach another tenant's
 * users (see docs/SECURITY_RULES.md #11 Tenant Isolation, #13 IDOR).
 */
export type AllowedCompanyIds = string[] | null;

export interface PaginatedUsers {
  data: User[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = [
  'createdAt',
  'email',
  'displayName',
  'status',
] as const;

/**
 * Administration CRUD over the User entity that already exists (Phase 05).
 * Deliberately reuses PasswordService for hashing rather than a second
 * implementation (Phase 08 §15) and does not touch authentication itself —
 * login/JWT/session behavior remains entirely AuthService's responsibility.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserCompany)
    private readonly userCompanyRepository: Repository<UserCompany>,
    private readonly passwordService: PasswordService,
  ) {}

  async findAll(
    query: ListUsersDto,
    allowedCompanyIds: AllowedCompanyIds,
  ): Promise<PaginatedUsers> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    if (allowedCompanyIds !== null && allowedCompanyIds.length === 0) {
      return { data: [], meta: { page, limit, total: 0 } };
    }

    const qb = this.userRepository.createQueryBuilder('user');

    if (allowedCompanyIds !== null) {
      qb.innerJoin(
        UserCompany,
        'membership',
        'membership.user_id = user.id AND membership.status = :membershipStatus AND membership.company_id IN (:...allowedCompanyIds)',
        {
          membershipStatus: MembershipStatus.Active,
          allowedCompanyIds,
        },
      );
    }

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('user.email LIKE :search', { search: `%${query.search}%` })
            .orWhere('user.displayName LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`user.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findById(
    id: string,
    allowedCompanyIds: AllowedCompanyIds,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user || !(await this.isVisible(id, allowedCompanyIds))) {
      throw new AppException(ErrorCode.NotFound, 'User not found');
    }
    return user;
  }

  /**
   * Whether the target user has an active membership in one of the
   * caller's allowed companies. null (DataScope.All) always passes.
   */
  private async isVisible(
    userId: string,
    allowedCompanyIds: AllowedCompanyIds,
  ): Promise<boolean> {
    if (allowedCompanyIds === null) {
      return true;
    }
    if (allowedCompanyIds.length === 0) {
      return false;
    }
    const count = await this.userCompanyRepository
      .createQueryBuilder('membership')
      .where('membership.user_id = :userId', { userId })
      .andWhere('membership.status = :status', {
        status: MembershipStatus.Active,
      })
      .andWhere('membership.company_id IN (:...allowedCompanyIds)', {
        allowedCompanyIds,
      })
      .getCount();
    return count > 0;
  }

  async findActiveById(id: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user || user.status !== UserStatus.Active) {
      return null;
    }
    return user;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async create(dto: CreateUserDto): Promise<User> {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new AppException(ErrorCode.Conflict, 'Email already registered');
    }

    if (!this.passwordService.validatePolicy(dto.password)) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Password does not meet the minimum requirements',
      );
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const displayName = dto.displayName ?? `${dto.firstName} ${dto.lastName}`;

    const user = this.userRepository.create({
      email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      displayName,
      status: UserStatus.Active,
      isEmailVerified: false,
      lastLoginAt: null,
      passwordChangedAt: null,
    });

    return this.userRepository.save(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    allowedCompanyIds: AllowedCompanyIds,
  ): Promise<User> {
    const user = await this.findById(id, allowedCompanyIds);

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.displayName !== undefined) user.displayName = dto.displayName;

    return this.userRepository.save(user);
  }

  async activate(
    id: string,
    allowedCompanyIds: AllowedCompanyIds,
  ): Promise<User> {
    const user = await this.findById(id, allowedCompanyIds);
    user.status = UserStatus.Active;
    return this.userRepository.save(user);
  }

  async deactivate(
    id: string,
    allowedCompanyIds: AllowedCompanyIds,
  ): Promise<User> {
    const user = await this.findById(id, allowedCompanyIds);
    user.status = UserStatus.Inactive;
    return this.userRepository.save(user);
  }

  async lock(
    id: string,
    allowedCompanyIds: AllowedCompanyIds,
  ): Promise<User> {
    const user = await this.findById(id, allowedCompanyIds);
    user.status = UserStatus.Locked;
    return this.userRepository.save(user);
  }

  async unlock(
    id: string,
    allowedCompanyIds: AllowedCompanyIds,
  ): Promise<User> {
    const user = await this.findById(id, allowedCompanyIds);
    user.status = UserStatus.Active;
    return this.userRepository.save(user);
  }

  /**
   * Soft delete only (project-wide policy against destroying historical
   * ERP data, Phase 08 §58, §122) — never a hard delete, regardless of
   * whether the user has any history.
   */
  async remove(id: string, allowedCompanyIds: AllowedCompanyIds): Promise<void> {
    const user = await this.findById(id, allowedCompanyIds);
    await this.userRepository.softRemove(user);
  }
}
