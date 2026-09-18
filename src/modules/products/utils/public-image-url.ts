import { isIP } from 'node:net';
import { isURL, registerDecorator, ValidationOptions } from 'class-validator';

/** Syntax validation only: this application never resolves or downloads image URLs. */
export function isPublicImageUrl(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    value !== value.trim()
  )
    return false;
  if (
    !isURL(value, {
      protocols: ['https'],
      require_protocol: true,
      require_tld: true,
      disallow_auth: true,
    })
  )
    return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    const labels = hostname.split('.');
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      !hostname.startsWith('[') &&
      isIP(hostname) === 0 &&
      labels.length > 1 &&
      !labels.includes('localhost') &&
      !['local', 'internal', 'lan', 'home', 'test', 'invalid'].includes(
        labels.at(-1) ?? '',
      )
    );
  } catch {
    return false;
  }
}

export function IsPublicImageUrl(
  options?: ValidationOptions,
): PropertyDecorator {
  return (object, propertyName) =>
    registerDecorator({
      name: 'isPublicImageUrl',
      target: object.constructor,
      propertyName: String(propertyName),
      options,
      validator: {
        validate: isPublicImageUrl,
        defaultMessage: () =>
          'imageUrl must be a public HTTPS image URL without credentials or a private host',
      },
    });
}
