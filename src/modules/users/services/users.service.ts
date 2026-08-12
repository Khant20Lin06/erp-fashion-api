import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserStatus } from '../entities/user-status.enum';
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
    private readonly passwordService: PasswordService,
  ) {}

  async findAll(query: ListUsersDto): Promise<PaginatedUsers> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.userRepository.createQueryBuilder('user');

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

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new AppException(ErrorCode.NotFound, 'User not found');
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

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.displayName !== undefined) user.displayName = dto.displayName;

    return this.userRepository.save(user);
  }

  async activate(id: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.Active;
    return this.userRepository.save(user);
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.Inactive;
    return this.userRepository.save(user);
  }

  async lock(id: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.Locked;
    return this.userRepository.save(user);
  }

  async unlock(id: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.Active;
    return this.userRepository.save(user);
  }

  /**
   * Soft delete only (project-wide policy against destroying historical
   * ERP data, Phase 08 §58, §122) — never a hard delete, regardless of
   * whether the user has any history.
   */
  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.softRemove(user);
  }
}
