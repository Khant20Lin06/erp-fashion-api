import { ConfigService } from '@nestjs/config';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('OpenAiCompatibleProvider', () => {
  let provider: OpenAiCompatibleProvider;
  let fetchMock: jest.Mock;

  const buildConfigService = (
    overrides: Record<string, unknown> = {},
  ): Pick<ConfigService, 'get'> => ({
    get: jest.fn().mockReturnValue({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'test-key',
      chatModel: 'test-chat-model',
      embeddingModel: 'test-embedding-model',
      requestTimeoutMs: 5000,
      ...overrides,
    }),
  });

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  describe('configuration guard', () => {
    it('throws InternalError rather than calling fetch when unconfigured', async () => {
      provider = new OpenAiCompatibleProvider(
        buildConfigService({
          baseUrl: undefined,
          apiKey: undefined,
          chatModel: undefined,
        }) as ConfigService,
      );
      await expect(
        provider.chat({ messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.InternalError });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('chat', () => {
    beforeEach(() => {
      provider = new OpenAiCompatibleProvider(
        buildConfigService() as ConfigService,
      );
    });

    it('returns a real chat result on 2xx', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            model: 'test-chat-model',
            choices: [{ message: { content: 'Hello!' } }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          }),
      });

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(result.content).toBe('Hello!');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });

    it('reports usage as null (never fabricated) when the provider omits it', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            model: 'test-chat-model',
            choices: [{ message: { content: 'Hello!' } }],
          }),
      });
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(result.usage).toBeNull();
    });

    it('maps a 429 response to RateLimited', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 429 });
      await expect(
        provider.chat({ messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.RateLimited });
    });

    it('maps a 500 response to InternalError', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      await expect(
        provider.chat({ messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.InternalError });
    });

    it('maps an aborted (timeout) request to InternalError, never a fabricated response', async () => {
      fetchMock.mockRejectedValue(
        Object.assign(new Error('aborted'), { name: 'AbortError' }),
      );
      await expect(
        provider.chat({ messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.InternalError });
    });

    it('maps an invalid (non-JSON) response to InternalError', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('invalid json')),
      });
      await expect(
        provider.chat({ messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.InternalError });
    });

    it('maps a response with no completion choices to InternalError rather than returning empty content silently mislabeled as success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ model: 'test-chat-model', choices: [] }),
      });
      await expect(
        provider.chat({ messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.InternalError });
    });

    it('includes the API key as a Bearer token and never logs it', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            model: 'test-chat-model',
            choices: [{ message: { content: 'ok' } }],
          }),
      });
      await provider.chat({ messages: [{ role: 'user', content: 'hi' }] });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer test-key');
    });
  });

  describe('embed', () => {
    beforeEach(() => {
      provider = new OpenAiCompatibleProvider(
        buildConfigService() as ConfigService,
      );
    });

    it('returns embeddings ordered by index, not raw response order', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            model: 'test-embedding-model',
            data: [
              { embedding: [2, 2], index: 1 },
              { embedding: [1, 1], index: 0 },
            ],
          }),
      });
      const result = await provider.embed(['a', 'b']);
      expect(result.embeddings).toEqual([
        [1, 1],
        [2, 2],
      ]);
    });

    it('throws InternalError when AI_EMBEDDING_MODEL is not configured', async () => {
      provider = new OpenAiCompatibleProvider(
        buildConfigService({ embeddingModel: undefined }) as ConfigService,
      );
      await expect(provider.embed(['a'])).rejects.toMatchObject({
        errorCode: ErrorCode.InternalError,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
