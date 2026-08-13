import { CustomerContact } from '../entities/customer-contact.entity';
import { SupplierContact } from '../entities/supplier-contact.entity';

export interface ContactResponseDto {
  id: string;
  ownerId: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toCustomerContactResponseDto(
  entity: CustomerContact,
): ContactResponseDto {
  return {
    id: entity.id,
    ownerId: entity.customerId,
    name: entity.name,
    jobTitle: entity.jobTitle,
    email: entity.email,
    phone: entity.phone,
    mobile: entity.mobile,
    isPrimary: entity.isPrimary,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export function toSupplierContactResponseDto(
  entity: SupplierContact,
): ContactResponseDto {
  return {
    id: entity.id,
    ownerId: entity.supplierId,
    name: entity.name,
    jobTitle: entity.jobTitle,
    email: entity.email,
    phone: entity.phone,
    mobile: entity.mobile,
    isPrimary: entity.isPrimary,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
