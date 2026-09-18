import { ConfigService } from '@nestjs/config';
import { CustomerAgentModelAdapter } from './customer-agent-model.adapter';

describe('CustomerAgentModelAdapter', () => {
  it('does not silently select the existing provider when Google is missing', () => {
    const adapter = new CustomerAgentModelAdapter(
      new ConfigService({
        CUSTOMER_MULTI_AGENT_ENABLED: true,
        AI_API_KEY: 'fixture',
        AI_BASE_URL: 'https://fixture.invalid',
        AI_CHAT_MODEL: 'fixture-model',
      }),
    );
    expect(adapter.configuration()).toBeNull();
  });
  it('requires a configured Google model even when a key is present', () => {
    const adapter = new CustomerAgentModelAdapter(
      new ConfigService({
        CUSTOMER_MULTI_AGENT_ENABLED: true,
        GEMINI_API_KEY: 'fixture',
      }),
    );
    expect(adapter.configuration()).toBeNull();
  });
  it('uses the explicitly selected compatible provider model fallback', () => {
    const adapter = new CustomerAgentModelAdapter(
      new ConfigService({
        CUSTOMER_MULTI_AGENT_ENABLED: 'true',
        CUSTOMER_MULTI_AGENT_PROVIDER: 'openai-compatible',
        AI_API_KEY: 'fixture',
        AI_BASE_URL: 'https://fixture.invalid',
        AI_CHAT_MODEL: 'fixture-model',
      }),
    );
    expect(adapter.configuration()).toEqual({
      provider: 'openai-compatible',
      model: 'fixture-model',
    });
  });
});
