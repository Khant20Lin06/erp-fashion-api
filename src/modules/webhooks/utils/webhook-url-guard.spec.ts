import { assertSafeWebhookUrl } from './webhook-url-guard';

describe('assertSafeWebhookUrl', () => {
  it('rejects an invalid URL', async () => {
    await expect(assertSafeWebhookUrl('not-a-url')).rejects.toMatchObject({
      errorCode: 'VALIDATION_ERROR',
    });
  });

  it('rejects a non-http(s) protocol', async () => {
    await expect(
      assertSafeWebhookUrl('ftp://example.com/hook'),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    await expect(
      assertSafeWebhookUrl('file:///etc/passwd'),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('rejects loopback IPv4 literals', async () => {
    await expect(
      assertSafeWebhookUrl('http://127.0.0.1/hook'),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('rejects "localhost" outright', async () => {
    await expect(
      assertSafeWebhookUrl('http://localhost:3000/hook'),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('rejects private RFC1918 ranges', async () => {
    await expect(
      assertSafeWebhookUrl('http://10.0.0.5/hook'),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    await expect(
      assertSafeWebhookUrl('http://172.16.0.1/hook'),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    await expect(
      assertSafeWebhookUrl('http://192.168.1.1/hook'),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('rejects the cloud metadata endpoint (link-local 169.254.0.0/16)', async () => {
    await expect(
      assertSafeWebhookUrl('http://169.254.169.254/latest/meta-data/'),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('rejects IPv6 loopback and unique-local literals', async () => {
    await expect(assertSafeWebhookUrl('http://[::1]/hook')).rejects.toMatchObject(
      { errorCode: 'VALIDATION_ERROR' },
    );
    await expect(
      assertSafeWebhookUrl('http://[fd00::1]/hook'),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('rejects an IPv4-mapped IPv6 loopback literal', async () => {
    await expect(
      assertSafeWebhookUrl('http://[::ffff:127.0.0.1]/hook'),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('accepts a public IPv4 literal', async () => {
    await expect(
      assertSafeWebhookUrl('https://8.8.8.8/hook'),
    ).resolves.toBeUndefined();
  });
});
