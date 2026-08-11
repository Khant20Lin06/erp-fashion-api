import { DataSourceOptions } from 'typeorm';
import { DatabaseConfig } from '../config/database.config';
import { User } from '../modules/users/entities/user.entity';
import { PasswordResetToken } from '../modules/users/entities/password-reset-token.entity';
import { Role } from '../modules/rbac/entities/role.entity';
import { Permission } from '../modules/rbac/entities/permission.entity';
import { RolePermission } from '../modules/rbac/entities/role-permission.entity';
import { UserRole } from '../modules/rbac/entities/user-role.entity';
import { RoleResourceScope } from '../modules/rbac/entities/role-resource-scope.entity';

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
