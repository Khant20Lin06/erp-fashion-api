import { Notification } from '../entities/notification.entity';
import { NotificationStatus } from '../entities/notification-status.enum';
import { NotificationChannel } from '../entities/notification-channel.enum';

export class NotificationResponseDto {
  id!: string;
  companyId!: string;
  userId!: string | null;
  eventType!: string;
  channel!: NotificationChannel;
  title!: string;
  body!: string;
  data!: Record<string, unknown>;
  status!: NotificationStatus;
  sentAt!: Date | null;
  failedAt!: Date | null;
  lastError!: string | null;
  readAt!: Date | null;
  createdAt!: Date;
}

export function toNotificationResponseDto(
  notification: Notification,
): NotificationResponseDto {
  return {
    id: notification.id,
    companyId: notification.companyId,
    userId: notification.userId,
    eventType: notification.eventType,
    channel: notification.channel,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    status: notification.status,
    sentAt: notification.sentAt,
    failedAt: notification.failedAt,
    lastError: notification.lastError,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}
