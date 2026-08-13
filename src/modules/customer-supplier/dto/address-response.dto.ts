import { CustomerAddress } from '../entities/customer-address.entity';
import { SupplierAddress } from '../entities/supplier-address.entity';
import { AddressType } from '../entities/address-type.enum';

export interface AddressResponseDto {
  id: string;
  ownerId: string;
  label: AddressType;
  recipientName: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toCustomerAddressResponseDto(
  entity: CustomerAddress,
): AddressResponseDto {
  return {
    id: entity.id,
    ownerId: entity.customerId,
    label: entity.label,
    recipientName: entity.recipientName,
    addressLine1: entity.addressLine1,
    addressLine2: entity.addressLine2,
    city: entity.city,
    state: entity.state,
    postalCode: entity.postalCode,
    country: entity.country,
    phone: entity.phone,
    isPrimary: entity.isPrimary,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export function toSupplierAddressResponseDto(
  entity: SupplierAddress,
): AddressResponseDto {
  return {
    id: entity.id,
    ownerId: entity.supplierId,
    label: entity.label,
    recipientName: entity.recipientName,
    addressLine1: entity.addressLine1,
    addressLine2: entity.addressLine2,
    city: entity.city,
    state: entity.state,
    postalCode: entity.postalCode,
    country: entity.country,
    phone: entity.phone,
    isPrimary: entity.isPrimary,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
