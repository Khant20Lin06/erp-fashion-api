import { IsOptional, IsUUID } from 'class-validator';
import { validateToolArguments } from './validate-tool-arguments';
import { DateRangeArgsDto } from './dto/date-range-args.dto';
import { ErrorCode } from '../../../core/errors/error-codes';

class TenantArgsDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

describe('validateToolArguments — never trust raw LLM-supplied arguments', () => {
  it('accepts valid arguments', async () => {
    const result = await validateToolArguments(DateRangeArgsDto, {
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });
    expect(result.fromDate).toBe('2026-01-01');
  });

  it('rejects an invalid date string rather than passing it through', async () => {
    await expect(
      validateToolArguments(DateRangeArgsDto, { fromDate: 'not-a-date' }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
  });

  it('rejects extra/unexpected properties the LLM tries to inject (whitelist + forbidNonWhitelisted)', async () => {
    await expect(
      validateToolArguments(DateRangeArgsDto, {
        fromDate: '2026-01-01',
        companyId: 'llm-supplied-company-override',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
  });

  it('treats a non-object argument payload as empty rather than throwing a raw TypeError', async () => {
    const result = await validateToolArguments(
      DateRangeArgsDto,
      'not an object',
    );
    expect(result.fromDate).toBeUndefined();
  });

  it('treats null/undefined arguments as empty', async () => {
    const result = await validateToolArguments(DateRangeArgsDto, null);
    expect(result.fromDate).toBeUndefined();
  });

  it('rejects a malformed UUID rather than passing it to a service query', async () => {
    await expect(
      validateToolArguments(TenantArgsDto, { companyId: 'not-a-uuid' }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
  });
});
