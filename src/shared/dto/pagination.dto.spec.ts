import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  PaginationDto,
} from './pagination.dto';

describe('PaginationDto', () => {
  it('defaults to page 1 and the default limit', async () => {
    const dto = plainToInstance(PaginationDto, {});
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(DEFAULT_PAGE);
    expect(dto.limit).toBe(DEFAULT_LIMIT);
  });

  it('rejects a limit above the maximum', async () => {
    const dto = plainToInstance(PaginationDto, { limit: MAX_LIMIT + 1 });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-positive page', async () => {
    const dto = plainToInstance(PaginationDto, { page: 0 });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('computes skip from page and limit', () => {
    const dto = plainToInstance(PaginationDto, { page: 3, limit: 10 });

    expect(dto.skip).toBe(20);
  });
});
