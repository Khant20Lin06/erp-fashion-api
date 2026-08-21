import { ConfigService } from '@nestjs/config';
import { HybridLlmProvider } from './hybrid-llm.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import { OllamaCompatibleProvider } from './ollama-compatible.provider';
import { LocalFallbackProvider } from './local-fallback.provider';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { LlmChatResult } from './llm-provider.interface';

describe('HybridLlmProvider', () => {
  let remoteProvider: jest.Mocked<Pick<OpenAiCompatibleProvider, 'chat' | 'embed'>>;
  let localLlmProvider: jest.Mocked<Pick<OllamaCompatibleProvider, 'chat' | 'embed'>>;
  let fallbackProvider: jest.Mocked<Pick<LocalFallbackProvider, 'chat' | 'embed'>>;

  const chatResult = (model: string): LlmChatResult => ({
    content: `answer from ${model}`,
    toolCalls: null,
    model,
    usage: null,
  });

  function buildProvider(configOverrides: Record<string, unknown>): HybridLlmProvider {
    const configService: Pick<ConfigService, 'get'> = {
      get: jest.fn().mockReturnValue({
        baseUrl: undefined,
        apiKey: undefined,
        chatModel: undefined,
        ollamaBaseUrl: undefined,
        ollamaChatModel: undefined,
        fallbackEnabled: true,
        ...configOverrides,
      }),
    };
    return new HybridLlmProvider(
      configService as ConfigService,
      remoteProvider as unknown as OpenAiCompatibleProvider,
      localLlmProvider as unknown as OllamaCompatibleProvider,
      fallbackProvider as unknown as LocalFallbackProvider,
    );
  }

  beforeEach(() => {
    remoteProvider = { chat: jest.fn(), embed: jest.fn() };
    localLlmProvider = { chat: jest.fn(), embed: jest.fn() };
    fallbackProvider = { chat: jest.fn(), embed: jest.fn() };
  });

  describe('provider priority', () => {
    it('uses the remote tier when configured and healthy, tagging the model as remote', async () => {
      remoteProvider.chat.mockResolvedValue(chatResult('gpt-4o-mini'));
      const provider = buildProvider({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        chatModel: 'gpt-4o-mini',
      });

      const result = await provider.chat({ messages: [] });

      expect(remoteProvider.chat).toHaveBeenCalledTimes(1);
      expect(localLlmProvider.chat).not.toHaveBeenCalled();
      expect(fallbackProvider.chat).not.toHaveBeenCalled();
      expect(result.model).toBe('remote:gpt-4o-mini');
    });

    it('falls through to local LLM when remote is unconfigured', async () => {
      localLlmProvider.chat.mockResolvedValue(chatResult('llama3'));
      const provider = buildProvider({
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaChatModel: 'llama3',
      });

      const result = await provider.chat({ messages: [] });

      expect(remoteProvider.chat).not.toHaveBeenCalled();
      expect(localLlmProvider.chat).toHaveBeenCalledTimes(1);
      expect(fallbackProvider.chat).not.toHaveBeenCalled();
      expect(result.model).toBe('local_llm:llama3');
    });

    it('falls through to local LLM when remote is configured but fails', async () => {
      remoteProvider.chat.mockRejectedValue(
        new AppException(ErrorCode.InternalError, 'AI provider is unreachable'),
      );
      localLlmProvider.chat.mockResolvedValue(chatResult('llama3'));
      const provider = buildProvider({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        chatModel: 'gpt-4o-mini',
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaChatModel: 'llama3',
      });

      const result = await provider.chat({ messages: [] });

      expect(remoteProvider.chat).toHaveBeenCalledTimes(1);
      expect(localLlmProvider.chat).toHaveBeenCalledTimes(1);
      expect(result.model).toBe('local_llm:llama3');
    });

    it('falls through to the deterministic fallback when neither remote nor local LLM is configured', async () => {
      fallbackProvider.chat.mockResolvedValue(chatResult('LocalFallbackProvider'));
      const provider = buildProvider({});

      const result = await provider.chat({ messages: [] });

      expect(remoteProvider.chat).not.toHaveBeenCalled();
      expect(localLlmProvider.chat).not.toHaveBeenCalled();
      expect(fallbackProvider.chat).toHaveBeenCalledTimes(1);
      // No tier prefix for the fallback — its own model string (class
      // name) is already unambiguous.
      expect(result.model).toBe('LocalFallbackProvider');
    });

    it('falls through to the deterministic fallback when both real tiers fail', async () => {
      remoteProvider.chat.mockRejectedValue(
        new AppException(ErrorCode.InternalError, 'unreachable'),
      );
      localLlmProvider.chat.mockRejectedValue(
        new AppException(ErrorCode.InternalError, 'unreachable'),
      );
      fallbackProvider.chat.mockResolvedValue(chatResult('LocalFallbackProvider'));
      const provider = buildProvider({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        chatModel: 'gpt-4o-mini',
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaChatModel: 'llama3',
      });

      const result = await provider.chat({ messages: [] });

      expect(fallbackProvider.chat).toHaveBeenCalledTimes(1);
      expect(result.model).toBe('LocalFallbackProvider');
    });

    it('never calls the fallback tier when fallback is disabled and remote succeeds', async () => {
      remoteProvider.chat.mockResolvedValue(chatResult('gpt-4o-mini'));
      const provider = buildProvider({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        chatModel: 'gpt-4o-mini',
        fallbackEnabled: false,
      });

      await provider.chat({ messages: [] });

      expect(fallbackProvider.chat).not.toHaveBeenCalled();
    });

    it('propagates the real error when fallback is disabled and every tier failed, never fabricating a generic error', async () => {
      const realError = new AppException(
        ErrorCode.InternalError,
        'AI provider is not configured (AI_BASE_URL/AI_API_KEY/AI_CHAT_MODEL)',
      );
      remoteProvider.chat.mockRejectedValue(realError);
      const provider = buildProvider({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        chatModel: 'gpt-4o-mini',
        fallbackEnabled: false,
      });

      await expect(provider.chat({ messages: [] })).rejects.toThrow(
        'AI provider is not configured (AI_BASE_URL/AI_API_KEY/AI_CHAT_MODEL)',
      );
      expect(fallbackProvider.chat).not.toHaveBeenCalled();
    });
  });

  describe('embed', () => {
    it('follows the same priority order and returns the result untagged (no model-string mutation)', async () => {
      fallbackProvider.embed.mockResolvedValue({
        embeddings: [[0.1, 0.2]],
        model: 'local-fallback-hash-v1',
        usage: null,
      });
      const provider = buildProvider({});

      const result = await provider.embed(['hello']);

      expect(fallbackProvider.embed).toHaveBeenCalledWith(['hello']);
      expect(result.model).toBe('local-fallback-hash-v1');
    });
  });

  describe('interface contract', () => {
    it('supports tool calling, never streaming', () => {
      const provider = buildProvider({});
      expect(provider.supportsToolCalling()).toBe(true);
      expect(provider.supportsStreaming()).toBe(false);
    });
  });
});
