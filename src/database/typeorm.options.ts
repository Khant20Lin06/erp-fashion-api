import { DataSourceOptions } from 'typeorm';
import { DatabaseConfig } from '../config/database.config';
import { User } from '../modules/users/entities/user.entity';
import { PasswordResetToken } from '../modules/users/entities/password-reset-token.entity';
import { Role } from '../modules/rbac/entities/role.entity';
import { Permission } from '../modules/rbac/entities/permission.entity';
import { RolePermission } from '../modules/rbac/entities/role-permission.entity';
import { UserRole } from '../modules/rbac/entities/user-role.entity';
import { RoleResourceScope } from '../modules/rbac/entities/role-resource-scope.entity';
import { Company } from '../modules/organization/entities/company.entity';
import { Branch } from '../modules/organization/entities/branch.entity';
import { Warehouse } from '../modules/organization/entities/warehouse.entity';
import { UserCompany } from '../modules/organization/entities/user-company.entity';
import { UserBranch } from '../modules/organization/entities/user-branch.entity';
import { UserWarehouse } from '../modules/organization/entities/user-warehouse.entity';
import { Employee } from '../modules/employees/entities/employee.entity';
import { SalesAccount } from '../modules/sales-accounts/entities/sales-account.entity';
import { SalesAccountAssignment } from '../modules/sales-accounts/entities/sales-account-assignment.entity';
import { Category } from '../modules/master-data/entities/category.entity';
import { Brand } from '../modules/master-data/entities/brand.entity';
import { Collection } from '../modules/master-data/entities/collection.entity';
import { AttributeOption } from '../modules/master-data/entities/attribute-option.entity';
import { Product } from '../modules/products/entities/product.entity';
import { ProductVariant } from '../modules/products/entities/product-variant.entity';
import { ProductVariantAttribute } from '../modules/products/entities/product-variant-attribute.entity';
import { ProductVariantBarcode } from '../modules/products/entities/product-variant-barcode.entity';
import { PriceList } from '../modules/products/entities/price-list.entity';
import { PriceListItem } from '../modules/products/entities/price-list-item.entity';

/**
 * Entities are imported explicitly rather than discovered via a glob.
 * A glob such as `__dirname + '/../**\/*.entity{.ts,.js}'` matches both the
 * bind-mounted TypeScript sources and the compiled dist/ output at once in
 * the Docker development container (nest start --watch runs from dist/ while
 * src/ is also present on disk), loading each entity class twice and
 * producing `EntityMetadataNotFoundError` for repositories injected via the
 * DI-registered (dist/) class identity.
 */
const entities = [
  User,
  PasswordResetToken,
  Role,
  Permission,
  RolePermission,
  UserRole,
  RoleResourceScope,
  Company,
  Branch,
  Warehouse,
  UserCompany,
  UserBranch,
  UserWarehouse,
  Employee,
  SalesAccount,
  SalesAccountAssignment,
  Category,
  Brand,
  Collection,
  AttributeOption,
  Product,
  ProductVariant,
  ProductVariantAttribute,
  ProductVariantBarcode,
  PriceList,
  PriceListItem,
];

export function buildDataSourceOptions(
  config: DatabaseConfig,
): DataSourceOptions {
  return {
    type: 'mysql',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    charset: 'utf8mb4_unicode_ci',
    synchronize: false,
    logging: config.logging,
    poolSize: config.poolSize,
    entities,
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    migrationsTableName: 'migrations',
  };
}
