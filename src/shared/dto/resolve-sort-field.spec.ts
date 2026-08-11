import { resolveSortField } from './resolve-sort-field';
import { AppException } from '../../core/errors/app.exception';

describe('resolveSortField', () => {
  const allowed = ['createdAt', 'email'] as const;

  it('returns the default field when none is requested', () => {
    expect(resolveSortField(undefined, allowed, 'createdAt')).toBe('createdAt');
  });

  it('returns the requested field when it is allowlisted', () => {
    expect(resolveSortField('email', allowed, 'createdAt')).toBe('email');
  });

  it('rejects a field that is not allowlisted', () => {
    expect(() =>
      resolveSortField('passwordHash', allowed, 'createdAt'),
    ).toThrow(AppException);
  });
});
