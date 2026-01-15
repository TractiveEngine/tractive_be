import Notification from '@/models/notification';
import mongoose from 'mongoose';

export type NotificationType =
  | 'bid_created'
  | 'bid_accepted'
  | 'order_created'
  | 'order_status_changed'
  | 'transaction_approved'
  | 'transaction_declined'
  | 'transaction_refunded'
  | 'shipping_accepted'
  | 'shipping_rejected'
  | 'support_ticket_updated'
  | 'chat_message'
  | 'generic';

export interface CreateNotificationOptions {
  user?: mongoose.Types.ObjectId | string;
  type?: NotificationType;
  title?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  isRead?: boolean;
}

/**
 * Create a notification
 */
export async function createNotification(options: CreateNotificationOptions = {}) {
  const {
    user,
    type = 'generic',
    title = 'Test Notification',
    message = 'This is a test notification',
    metadata = {},
    isRead = false,
  } = options;

  if (!user) {
    throw new Error('Notification user is required');
  }

  const notification = await Notification.create({
    user,
    type,
    title,
    message,
    metadata,
    isRead,
  });

  return notification;
}

/**
 * Create multiple notifications
 */
export async function createNotifications(
  count: number,
  user: mongoose.Types.ObjectId | string,
  options: Omit<CreateNotificationOptions, 'user'> = {}
) {
  const notifications = [];
  for (let i = 0; i < count; i++) {
    notifications.push(await createNotification({ ...options, user }));
  }
  return notifications;
}
