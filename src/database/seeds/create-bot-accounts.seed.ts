import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { hash } from '@node-rs/argon2';
import { randomBytes } from 'crypto';
import { AppDataSource } from '../data-source';
import {
  createScriptLogger,
  logScriptFailure,
} from '../../common/logging/script-logger';
import { User } from '../../modules/users/entities/user.entity';
import { UserStatus } from '../../modules/users/entities/user-status.enum';
import { UserCompany } from '../../modules/organization/entities/user-company.entity';
import { MembershipStatus } from '../../modules/organization/entities/membership-status.enum';
import { Company } from '../../modules/organization/entities/company.entity';
import { CompanyStatus } from '../../modules/organization/entities/company-status.enum';
import { Role } from '../../modules/rbac/entities/role.entity';
import { RolePermission } from '../../modules/rbac/entities/role-permission.entity';
import { RoleResourceScope } from '../../modules/rbac/entities/role-resource-scope.entity';
import { RoleStatus } from '../../modules/rbac/entities/role-status.enum';
import { Permission } from '../../modules/rbac/entities/permission.entity';
import { UserRole } from '../../modules/rbac/entities/user-role.entity';
import { DataScope } from '../../modules/rbac/enums/data-scope.enum';

const logger = createScriptLogger('CreateBotAccountsSeed');

/**
 * Bootstraps the two Telegram bot service accounts (Customer Service Bot,
 * Customer Order Bot) — deliberately separate roles/users from the
 * Telegram Admin Bot's account, and from any human ERP user. Least
 * privilege (docs/SECURITY_RULES.md #8): each role gets exactly the
 * permissions its bot integration needs, scoped to a single company via
 * DataScope.Company (never DataScope.All) so a compromised bot token can
 * never reach another tenant's data.
 *
 * Run once per deployment (idempotent — re-running updates rather than
 * duplicating). The printed passwords are for this script's own
 * subsequent login-and-get-a-JWT step (the n8n workflow's "Login As Bot"
 * node, same pattern as the Telegram Admin Bot workflow) — rotate them
 * out of any place they're pasted into after initial setup.
 */

interface BotAccountSpec {
  roleCode: string;
  roleName: string;
  roleDescription: string;
  email: string;
  displayName: string;
  permissionCodes: string[];
  /** Resources this role needs DataScope.Company for (drives resolveRequestCompanyId). */
  companyScopedResources: string[];
}

const BOT_ACCOUNTS: BotAccountSpec[] = [
  {
    roleCode: 'CUSTOMER_SERVICE_BOT',
    roleName: 'Customer Service Bot',
    roleDescription:
      'Telegram customer-facing bot: Q&A, identity linking, and draft order intake. No access to other customers, financials, or admin functions.',
    email: 'bot.customer-service@fashionerp.internal',
    displayName: 'Customer Service Bot',
    permissionCodes: [
      'customer_portal.link',
      'customer_portal.order.create',
      'customer_portal.profile',
      'products.read',
      'ai_assistant.chat',
    ],
    companyScopedResources: ['products', 'ai_assistant'],
  },
  {
    roleCode: 'CUSTOMER_ORDER_BOT',
    roleName: 'Customer Order Bot',
    roleDescription:
      'Telegram admin-facing bot: confirms/cancels/ships customer orders via inline buttons, and looks up which Telegram chat to notify on a status change. Sales + notify-lookup only — no customer PII beyond a Telegram id, no product or financial-report access.',
    email: 'bot.customer-order@fashionerp.internal',
    displayName: 'Customer Order Bot',
    permissionCodes: [
      'sales.read',
      'sales.confirm',
      'sales.cancel',
      'sales.ship',
      'sales.deliver',
      'customer_portal.notify_lookup',
    ],
    companyScopedResources: ['sales'],
  },
];

function generateServiceAccountPassword(): string {
  // 24 random bytes -> 32-char base64url, well past PasswordService's
  // 12-char minimum with no realistic risk of collision with the
  // denylist — these accounts are never logged into interactively.
  return randomBytes(24).toString('base64url');
}

async function seedBotAccounts(): Promise<void> {
  await AppDataSource.initialize();
  logger.log('Database connected.');

  const userRepository = AppDataSource.getRepository(User);
  const userCompanyRepository = AppDataSource.getRepository(UserCompany);
  const companyRepository = AppDataSource.getRepository(Company);
  const roleRepository = AppDataSource.getRepository(Role);
  const rolePermissionRepository = AppDataSource.getRepository(RolePermission);
  const roleResourceScopeRepository =
    AppDataSource.getRepository(RoleResourceScope);
  const permissionRepository = AppDataSource.getRepository(Permission);
  const userRoleRepository = AppDataSource.getRepository(UserRole);

  const company = await companyRepository.findOne({
    where: { status: CompanyStatus.Active },
    order: { createdAt: 'ASC' },
  });

  if (!company) {
    throw new Error(
      'No active Company found — create a company first (see seed:enterprise or the Companies API) before running this seed.',
    );
  }
  logger.log(`Using company: ${company.name} (${company.id})`);

  const credentials: Array<{ email: string; password: string }> = [];

  for (const spec of BOT_ACCOUNTS) {
    let role = await roleRepository.findOne({ where: { code: spec.roleCode } });
    if (!role) {
      role = roleRepository.create({
        name: spec.roleName,
        code: spec.roleCode,
        description: spec.roleDescription,
        status: RoleStatus.Active,
        isSystemRole: false,
      });
      role = await roleRepository.save(role);
      logger.log(`Created role: ${spec.roleCode}`);
    }

    for (const code of spec.permissionCodes) {
      const permission = await permissionRepository.findOne({ where: { code } });
      if (!permission) {
        throw new Error(
          `Permission "${code}" not found — run "npm run seed:rbac" first.`,
        );
      }

      const existingGrant = await rolePermissionRepository.findOne({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (!existingGrant) {
        await rolePermissionRepository.save(
          rolePermissionRepository.create({
            roleId: role.id,
            permissionId: permission.id,
          }),
        );
        logger.log(`Granted ${code} to ${spec.roleCode}`);
      }
    }

    for (const resource of spec.companyScopedResources) {
      const existingScope = await roleResourceScopeRepository.findOne({
        where: { roleId: role.id, resource },
      });
      if (!existingScope) {
        await roleResourceScopeRepository.save(
          roleResourceScopeRepository.create({
            roleId: role.id,
            resource,
            scope: DataScope.Company,
            scopeValue: null,
          }),
        );
        logger.log(`Granted COMPANY scope for ${resource} to ${spec.roleCode}`);
      }
    }

    let user = await userRepository.findOne({ where: { email: spec.email } });
    const password = generateServiceAccountPassword();

    if (!user) {
      const passwordHash = await hash(password);
      user = userRepository.create({
        id: uuidv4(),
        email: spec.email,
        passwordHash,
        firstName: spec.displayName,
        lastName: 'Service Account',
        displayName: spec.displayName,
        status: UserStatus.Active,
        isEmailVerified: true,
      });
      user = await userRepository.save(user);
      credentials.push({ email: spec.email, password });
      logger.log(`Created service-account user: ${spec.email}`);
    } else {
      logger.log(
        `Service-account user already exists: ${spec.email} (password unchanged — delete the user first to rotate it via this script)`,
      );
    }

    const existingUserRole = await userRoleRepository.findOne({
      where: { userId: user.id, roleId: role.id },
    });
    if (!existingUserRole) {
      await userRoleRepository.save(
        userRoleRepository.create({ userId: user.id, roleId: role.id }),
      );
      logger.log(`Assigned ${spec.roleCode} to ${spec.email}`);
    }

    const existingMembership = await userCompanyRepository.findOne({
      where: { userId: user.id, companyId: company.id },
    });
    if (!existingMembership) {
      await userCompanyRepository.save(
        userCompanyRepository.create({
          userId: user.id,
          companyId: company.id,
          status: MembershipStatus.Active,
          isPrimary: true,
        }),
      );
      logger.log(`Assigned ${spec.email} to company ${company.name}`);
    }
  }

  await AppDataSource.destroy();

  if (credentials.length > 0) {
    logger.log('=== NEW SERVICE ACCOUNT CREDENTIALS (save these now) ===');
    for (const cred of credentials) {
      logger.log(`${cred.email} : ${cred.password}`);
    }
    logger.log(
      'These are shown only once. Store them in the n8n workflow credentials (not in the workflow JSON) for the "Login As Bot" node.',
    );
  }

  logger.log('Bot account setup complete!');
}

seedBotAccounts().catch((err) => {
  logScriptFailure('Error creating bot accounts', err, logger);
  process.exit(1);
});
