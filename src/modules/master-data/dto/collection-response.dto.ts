import { Collection } from '../entities/collection.entity';
import { CollectionStatus } from '../entities/collection-status.enum';
import { Season } from '../entities/season.enum';

export interface CollectionResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  season: Season;
  year: number | null;
  status: CollectionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toCollectionResponseDto(
  collection: Collection,
): CollectionResponseDto {
  return {
    id: collection.id,
    companyId: collection.companyId,
    code: collection.code,
    name: collection.name,
    description: collection.description,
    season: collection.season,
    year: collection.year,
    status: collection.status,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
}
