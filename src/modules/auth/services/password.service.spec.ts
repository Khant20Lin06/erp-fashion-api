import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hashes a password to a value different from the plaintext', async () => {
    const passwordHash = await service.hash('correct horse battery staple');

    expect(passwordHash).not.toBe('correct horse battery staple');
    expect(passwordHash).toContain('$argon2id$');
  });

  it('verifies a correct password against its hash', async () => {
    const passwordHash = await service.hash('correct horse battery staple');

    await expect(
      service.verify('correct horse battery staple', passwordHash),
    ).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const passwordHash = await service.hash('correct horse battery staple');

    await expect(service.verify('wrong password', passwordHash)).resolves.toBe(
      false,
    );
  });

  it('produces different hashes for the same password (salted)', async () => {
    const hashA = await service.hash('same-password');
    const hashB = await service.hash('same-password');

    expect(hashA).not.toBe(hashB);
  });

  describe('validatePolicy', () => {
    it('accepts a password meeting the minimum length', () => {
      expect(service.validatePolicy('12345678')).toBe(true);
    });

    it('rejects a password shorter than the minimum length', () => {
      expect(service.validatePolicy('short')).toBe(false);
    });
  });
});
