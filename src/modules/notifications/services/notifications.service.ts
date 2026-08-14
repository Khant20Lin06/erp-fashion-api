import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationStatus } from '../entities/notification-status.enum';
import { NotificationChannel } from '../entities/notification-channel.enum';
import { ListNotificationsDto } from '../dto/list-notifications.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';

export interface PaginatedNotifications {
  data: Notification[];
  meta: { page: number; limit: number; total: number };
}

export interface CreateNotificationInput {
  companyId: string;
  eventType: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sourceEventId: string;
}

/**
 * Owns Notification persistence for all three callers this phase has:
 * NotificationEventConsumer (create, PENDING), NotificationWorker (status
 * transitions), and NotificationsController (read + mark-read). Kept as a
 * single service (not split further) since, unlike ReportsModule, there is
 * no evidence here of multiple independently-varying read models — every
 * caller operates on the same Notification row shape.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async findAll(
    companyId: string,
    query: ListNotificationsDto,
  ): Promise<PaginatedNotifications> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const [data, total] = await this.notificationRepository.findAndCount({
      where: { companyId },
      order: { createdAt: query.order ?? 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, companyId },
    });
    if (!notification) {
      throw new AppException(ErrorCode.NotFound, 'Notification not found');
    }
    return notification;
  }

  /** Plain lookup by id only — used by NotificationWorker, which is not company-scoped by an HTTP request (it re-reads by the job's notificationId). */
  async findById(id: string): Promise<Notification | null> {
    return this.notificationRepository.findOne({ where: { id } });
  }

  async markRead(id: string, companyId: string): Promise<Notification> {
    const notification = await this.findByIdInCompany(id, companyId);
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationRepository.save(notification);
    }
    return notification;
  }

  /**
   * Creates a PENDING Notification row (called by NotificationEventConsumer
   * only). Idempotent by construction via the DB's own
   * UNIQUE(source_event_id, channel) constraint (mirrors
   * AccountingPostingService.postPayment()'s / JournalEntriesService's own
   * "check first, then let the UNIQUE constraint be the race backstop"
   * pattern) — a duplicate insert attempt returns the existing row instead
   * of throwing, since Kafka redelivery of the same event is an expected,
   * not exceptional, occurrence.
   */
  async createPending(input: CreateNotificationInput): Promise<Notification> {
    const existing = await this.notificationRepository.findOne({
      where: { sourceEventId: input.sourceEventId, channel: input.channel },
    });
    if (existing) {
      return existing;
    }

    const notification = this.notificationRepository.create({
      companyId: input.companyId,
      userId: null,
      eventType: input.eventType,
      channel: input.channel,
      title: input.title,
      body: input.body,
      data: input.data,
      status: NotificationStatus.Pending,
      sourceEventId: input.sourceEventId,
      sentAt: null,
      failedAt: null,
      lastError: null,
      readAt: null,
    });

    try {
      return await this.notificationRepository.save(notification);
    } catch (error) {
      if (this.isDuplicateSourceEventChannelError(error)) {
        const winner = await this.notificationRepository.findOne({
          where: {
            sourceEventId: input.sourceEventId,
            channel: input.channel,
          },
        });
        if (winner) {
          return winner;
        }
      }
      throw error;
    }
  }

  async markSent(id: string): Promise<void> {
    await this.notificationRepository.update(id, {
      status: NotificationStatus.Sent,
      sentAt: new Date(),
      lastError: null,
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.notificationRepository.update(id, {
      status: NotificationStatus.Failed,
      failedAt: new Date(),
      lastError: errorMessage.slice(0, 1000),
    });
  }

  private isDuplicateSourceEventChannelError(error: unknown): boolean {
    const err = error as {
      code?: string;
      errno?: number;
      driverError?: { code?: string; errno?: number };
    };
    const code = err?.code ?? err?.driverError?.code;
    const errno = err?.errno ?? err?.driverError?.errno;
    return code === 'ER_DUP_ENTRY' || errno === 1062;
  }
}
