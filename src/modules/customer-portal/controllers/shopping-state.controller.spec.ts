import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ShoppingStateController } from './shopping-state.controller';
import { ShoppingStateService } from '../services/shopping-state.service';
import { CustomerAgentToolsService } from '../services/customer-agent-tools.service';
import { ShoppingAssistantService } from '../services/shopping-assistant.service';
import { CustomerAssistantDto } from '../dto/customer-assistant.dto';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { ShoppingStepDto } from '../dto/shopping-step.dto';
import { PERMISSION_METADATA_KEY } from '../../rbac/decorators/require-permission.decorator';

describe('shopping step authorization and boundary', () => {
  it('requires both bot order and catalog permissions', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        // Metadata inspection only; the unbound handler is never called.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ShoppingStateController.prototype.step,
      ),
    ).toEqual({
      codes: ['customer_portal.order.create', 'products.read'],
      mode: 'ALL',
    });
  });
  it('rejects an unauthorized company before touching persisted state', async () => {
    const shopping = { step: jest.fn() };
    const scope = {
      resolveScope: jest.fn().mockResolvedValue({}),
      resolveAllowedCompanyIds: jest.fn().mockResolvedValue(['allowed']),
    };
    const controller = new ShoppingStateController(
      shopping as unknown as ShoppingStateService,
      scope as unknown as DataScopeService,
      {} as CustomerAgentToolsService,
      {} as ShoppingAssistantService,
    );
    await expect(
      controller.step(
        { id: 'authenticated-bot' },
        {
          companyId: 'other',
          update: {},
        },
      ),
    ).rejects.toBeDefined();
    expect(shopping.step).not.toHaveBeenCalled();
  });
  it('uses the authenticated integration identity', async () => {
    const shopping = { step: jest.fn().mockResolvedValue({ status: 'ready' }) };
    const scope = {
      resolveScope: jest.fn().mockResolvedValue({}),
      resolveAllowedCompanyIds: jest.fn().mockResolvedValue(['allowed']),
    };
    await new ShoppingStateController(
      shopping as unknown as ShoppingStateService,
      scope as unknown as DataScopeService,
      {} as CustomerAgentToolsService,
      {} as ShoppingAssistantService,
    ).step(
      { id: 'real-bot' },
      {
        companyId: 'allowed',
        update: {},
      },
    );
    expect(shopping.step).toHaveBeenCalledWith('real-bot', {
      companyId: 'allowed',
      update: {},
    });
  });
  it('rejects unrecognized continuation credentials and invalid status codes', async () => {
    const dto = plainToInstance(ShoppingStepDto, {
      companyId: 'bdaf7c02-c6e9-4a1f-8c34-2b1bda4ca198',
      update: {},
      cookieHeader: 'secret',
      response: { statusCode: 999, headers: { cookie: 'secret' } },
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.some((e) => e.property === 'cookieHeader')).toBe(true);
    expect(
      errors
        .find((e) => e.property === 'response')
        ?.children?.map((e) => e.property),
    ).toEqual(expect.arrayContaining(['headers', 'statusCode']));
  });
  it('assistant endpoint has the same permission boundary and rejects supplied context/identity', async () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        ShoppingStateController.prototype.runAssistant,
      ),
    ).toEqual({
      codes: ['customer_portal.order.create', 'products.read'],
      mode: 'ALL',
    });
    const dto = plainToInstance(CustomerAssistantDto, {
      companyId: 'bdaf7c02-c6e9-4a1f-8c34-2b1bda4ca198',
      update: {},
      operationToken: 'f7c4211b-f83d-45fa-899c-f84068230ba3',
      context: {},
      userId: 'other',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(['context', 'userId']),
    );
  });
  it('rejects another company before running the AI team', async () => {
    const assistant = { run: jest.fn() };
    const scope = {
      resolveScope: jest.fn().mockResolvedValue({}),
      resolveAllowedCompanyIds: jest.fn().mockResolvedValue(['allowed']),
    };
    const c = new ShoppingStateController(
      {} as ShoppingStateService,
      scope as unknown as DataScopeService,
      {} as CustomerAgentToolsService,
      assistant as unknown as ShoppingAssistantService,
    );
    await expect(
      c.runAssistant(
        { id: 'real-bot' },
        { companyId: 'other', update: {}, operationToken: 'token' },
      ),
    ).rejects.toThrow();
    expect(assistant.run).not.toHaveBeenCalled();
  });
});
