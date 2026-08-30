import 'dotenv/config';
import { AppDataSource } from '../data-source';
import {
  createScriptLogger,
  logScriptFailure,
} from '../../common/logging/script-logger';
import { User } from '../../modules/users/entities/user.entity';
import { UserStatus } from '../../modules/users/entities/user-status.enum';
import { Role } from '../../modules/rbac/entities/role.entity';
import { UserRole } from '../../modules/rbac/entities/user-role.entity';
import { SystemRoleCode } from '../../modules/rbac/entities/system-role-code';
import { hash } from '@node-rs/argon2';
import { v4 as uuidv4 } from 'uuid';

const logger = createScriptLogger('CreateAdminSeed');

async function createAdminUser() {
  await AppDataSource.initialize();
  logger.log('Database connected.');

  const email = 'admin@fashionerp.com';
  const password = 'Admin-12345678!';

  const userRepository = AppDataSource.getRepository(User);
  const roleRepository = AppDataSource.getRepository(Role);
  const userRoleRepository = AppDataSource.getRepository(UserRole);

  let existingUser = await userRepository.findOne({ where: { email } });
  const passwordHash = await hash(password);

  if (!existingUser) {
    existingUser = userRepository.create({
      id: uuidv4(),
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      displayName: 'System Admin',
      status: UserStatus.Active,
      isEmailVerified: true,
    });
    await userRepository.save(existingUser);
    logger.log(`Created admin user: ${email}`);
  } else {
    existingUser.passwordHash = passwordHash;
    existingUser.status = UserStatus.Active;
    await userRepository.save(existingUser);
    logger.log(`Updated admin user password for: ${email}`);
  }

  const superAdminRole = await roleRepository.findOne({
    where: { code: SystemRoleCode.SuperAdmin },
  });

  if (superAdminRole) {
    const existingUserRole = await userRoleRepository.findOne({
      where: { userId: existingUser.id, roleId: superAdminRole.id },
    });

    if (!existingUserRole) {
      await userRoleRepository.save(
        userRoleRepository.create({
          userId: existingUser.id,
          roleId: superAdminRole.id,
        }),
      );
      logger.log('Assigned SUPER_ADMIN role to admin user.');
    }
  }

  await AppDataSource.destroy();
  logger.log('Admin account setup complete!');
}

createAdminUser().catch((err) => {
  logScriptFailure('Error creating admin user', err, logger);
  process.exit(1);
});
