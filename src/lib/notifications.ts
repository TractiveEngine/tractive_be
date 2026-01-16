import Notification from '@/models/notification';
import dbConnect from '@/lib/dbConnect';

export interface CreateNotificationParams {
  userId: string;
  type?: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification for a user
 * This helper is called from various modules when events occur
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    await dbConnect();
    
    const notification = await Notification.create({
      user: params.userId,
      type: params.type ?? 'generic',
      title: params.title,
      message: params.message,
      metadata: params.metadata ?? {},
      isRead: false
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    // Don't throw - notifications should not break main flow
    return null;
  }
}

/**
 * Create notifications for multiple users
 */
export async function createBulkNotifications(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
) {
  try {
    await dbConnect();
    
    const notifications = await Promise.all(
      userIds.map(userId => 
        createNotification({ ...params, userId })
      )
    );

    return notifications.filter(n => n !== null);
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    return [];
  }
}
