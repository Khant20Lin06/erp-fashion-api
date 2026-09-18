import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CatalogDiscoveryQueryDto } from './catalog.dto';

describe('CatalogDiscoveryQueryDto', () => {
  it('accepts bounded GET parameters without converting decimal money to floats', async () => {
    const dto = plainToInstance(CatalogDiscoveryQueryDto, {
      query: 'pants',
      size: 'M',
      maxPrice: '30.01',
      currency: 'USD',
      offset: '12',
      mode: 'similar',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.offset).toBe(12);
    expect(dto.maxPrice).toBe('30.01');
  });

  it.each([
    { offset: -1 },
    { offset: 10001 },
    { offset: 'abc' },
    { mode: 'anything' },
    { maxPrice: '-1' },
    { maxPrice: 'NaN' },
    { maxPrice: '1.001' },
    { currency: 'usd' },
    { exclude: 'a'.repeat(2221) },
    { query: 'x'.repeat(101) },
  ])('rejects malformed or unbounded filters %j', async (input) => {
    expect(
      (await validate(plainToInstance(CatalogDiscoveryQueryDto, input))).length,
    ).toBeGreaterThan(0);
  });
});
