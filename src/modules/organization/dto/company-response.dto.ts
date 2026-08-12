import { Company } from '../entities/company.entity';
import { CompanyStatus } from '../entities/company-status.enum';

export interface CompanyResponseDto {
  id: string;
  code: string;
  name: string;
  status: CompanyStatus;
  baseCurrency: string;
  timezone: string;
  country: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toCompanyResponseDto(company: Company): CompanyResponseDto {
  return {
    id: company.id,
    code: company.code,
    name: company.name,
    status: company.status,
    baseCurrency: company.baseCurrency,
    timezone: company.timezone,
    country: company.country,
    phone: company.phone,
    email: company.email,
    address: company.address,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}
