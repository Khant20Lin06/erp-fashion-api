import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Collection } from '../entities/collection.entity';
import { CollectionStatus } from '../entities/collection-status.enum';
import { CreateCollectionDto } from '../dto/create-collection.dto';
import { UpdateCollectionDto } from '../dto/update-collection.dto';
import { ListCollectionsDto } from '../dto/list-collections.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedCollections {
  data: Collection[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = [
  'createdAt',
  'name',
  'code',
  'status',
  'year',
] as const;

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListCollectionsDto,
  ): Promise<PaginatedCollections> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.collectionRepository
      .createQueryBuilder('collection')
      .where('collection.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('collection.status = :status', { status: query.status });
    }
    if (query.season) {
      qb.andWhere('collection.season = :season', { season: query.season });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('collection.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('collection.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`collection.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<Collection> {
    const collection = await this.collectionRepository.findOne({
      where: { id, companyId },
    });
    if (!collection) {
      throw new AppException(ErrorCode.NotFound, 'Collection not found');
    }
    return collection;
  }

  async create(
    companyId: string,
    dto: CreateCollectionDto,
  ): Promise<Collection> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.collectionRepository.findOne({
      where: { companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Collection code already exists for this company',
      );
    }

    const collection = this.collectionRepository.create({
      companyId,
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      season: dto.season,
      year: dto.year ?? null,
      status: CollectionStatus.Active,
    });

    return this.collectionRepository.save(collection);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateCollectionDto,
  ): Promise<Collection> {
    const collection = await this.findByIdInCompany(id, companyId);

    if (dto.name !== undefined) collection.name = dto.name;
    if (dto.description !== undefined) collection.description = dto.description;
    if (dto.season !== undefined) collection.season = dto.season;
    if (dto.year !== undefined) collection.year = dto.year;

    return this.collectionRepository.save(collection);
  }

  async activate(id: string, companyId: string): Promise<Collection> {
    const collection = await this.findByIdInCompany(id, companyId);
    collection.status = CollectionStatus.Active;
    return this.collectionRepository.save(collection);
  }

  async deactivate(id: string, companyId: string): Promise<Collection> {
    const collection = await this.findByIdInCompany(id, companyId);
    collection.status = CollectionStatus.Inactive;
    return this.collectionRepository.save(collection);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const collection = await this.findByIdInCompany(id, companyId);
    await this.collectionRepository.softRemove(collection);
  }
}
