import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiConversationService } from './ai-conversation.service';
import { AiConversation } from '../entities/ai-conversation.entity';
import { AiMessage } from '../entities/ai-message.entity';
import { AiMessageRole } from '../entities/ai-message-role.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('AiConversationService', () => {
  let service: AiConversationService;
  let conversationRepository: jest.Mocked<
    Pick<
      Repository<AiConversation>,
      | 'findOne'
      | 'findAndCount'
      | 'create'
      | 'save'
      | 'softRemove'
      | 'createQueryBuilder'
    >
  >;
  let messageRepository: jest.Mocked<
    Pick<Repository<AiMessage>, 'find' | 'create' | 'save'>
  >;

  const buildConversation = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'conv-1',
      companyId: 'company-a',
      branchId: null,
      userId: 'user-1',
      title: null,
      ...overrides,
    }) as AiConversation;

  beforeEach(() => {
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    conversationRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      create: jest.fn((data: unknown) => data as AiConversation) as never,
      save: jest.fn((data: unknown) =>
        Promise.resolve(data as AiConversation),
      ) as never,
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    messageRepository = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data: unknown) => data as AiMessage) as never,
      save: jest.fn((data: unknown) =>
        Promise.resolve(data as AiMessage),
      ) as never,
    };

    const configService: Pick<ConfigService, 'get'> = {
      get: jest.fn().mockReturnValue({ maxHistoryMessages: 20 }),
    };

    service = new AiConversationService(
      conversationRepository as unknown as Repository<AiConversation>,
      messageRepository as unknown as Repository<AiMessage>,
      configService as ConfigService,
    );
  });

  describe('findOwnedByIdOrThrow — strict ownership (company AND user)', () => {
    it('returns the conversation when it belongs to the requesting company and user', async () => {
      conversationRepository.findOne.mockResolvedValue(buildConversation());
      const conversation = await service.findOwnedByIdOrThrow(
        'conv-1',
        'company-a',
        'user-1',
      );
      expect(conversation.id).toBe('conv-1');
      expect(conversationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'conv-1', companyId: 'company-a', userId: 'user-1' },
      });
    });

    it("throws NotFound for another company's conversation — never leaks existence", async () => {
      conversationRepository.findOne.mockResolvedValue(null);
      await expect(
        service.findOwnedByIdOrThrow('conv-1', 'company-b', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it("throws NotFound for another user's conversation in the SAME company (no shared-conversation mechanism)", async () => {
      conversationRepository.findOne.mockResolvedValue(null);
      await expect(
        service.findOwnedByIdOrThrow('conv-1', 'company-a', 'user-2'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('getOrCreate', () => {
    it('creates a new conversation owned by the requesting company and user when no id is given', async () => {
      const conversation = await service.getOrCreate(
        undefined,
        'company-a',
        undefined,
        'user-1',
      );
      expect(conversation.companyId).toBe('company-a');
      expect(conversation.userId).toBe('user-1');
    });

    it('loads (and re-validates ownership of) an existing conversation when an id is given', async () => {
      conversationRepository.findOne.mockResolvedValue(buildConversation());
      const conversation = await service.getOrCreate(
        'conv-1',
        'company-a',
        undefined,
        'user-1',
      );
      expect(conversation.id).toBe('conv-1');
    });
  });

  describe('getRecentMessages — bounded history', () => {
    it('never requests more than the configured maxHistoryMessages', async () => {
      await service.getRecentMessages('conv-1');
      expect(messageRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('returns messages in chronological order (oldest first) for prompt construction', async () => {
      messageRepository.find.mockResolvedValue([
        { id: 'm2', createdAt: new Date('2026-01-02') } as AiMessage,
        { id: 'm1', createdAt: new Date('2026-01-01') } as AiMessage,
      ]);
      const messages = await service.getRecentMessages('conv-1');
      expect(messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    });
  });

  describe('appendMessage', () => {
    it('validates the role is one of the fixed enum values via the type system (no arbitrary role string)', async () => {
      const message = await service.appendMessage(
        'conv-1',
        AiMessageRole.User,
        'What were today sales?',
      );
      expect(message.role).toBe(AiMessageRole.User);
    });
  });
});
