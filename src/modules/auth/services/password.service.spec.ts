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
    it('accepts a password meeting the minimum length and character diversity', () => {
      expect(service.validatePolicy('correct-horse-battery-9')).toBe(true);
    });

    it('rejects a password shorter than the minimum length', () => {
      expect(service.validatePolicy('short1!')).toBe(false);
    });

    it('rejects a password with no digit or symbol (letters only)', () => {
      expect(service.validatePolicy('onlylettersnodigits')).toBe(false);
    });

    it('rejects a password with no letters (digits only)', () => {
      expect(service.validatePolicy('123456789012')).toBe(false);
    });

    it('rejects a password on the common weak-password denylist', () => {
      expect(service.validatePolicy('password1234')).toBe(false);
    });

    it('rejects a password over the maximum length', () => {
      expect(service.validatePolicy(`a1${'x'.repeat(130)}`)).toBe(false);
    });
  });
});
