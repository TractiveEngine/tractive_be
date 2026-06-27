import dbConnect from '@/lib/dbConnect';
import Notification from '@/models/notification';
import { getAuthUser } from '@/lib/apiAuth';

const encoder = new TextEncoder();
const STREAM_POLL_MS = 15000;
const HEARTBEAT_MS = 10000;

function serializeNotification(notification: any) {
  if (!notification) return null;
  return {
    _id: notification._id?.toString?.() || notification._id,
    user: notification.user?.toString?.() || notification.user,
    type: notification.type || 'generic',
    title: notification.title || '',
    message: notification.message || '',
    metadata: notification.metadata || {},
    isRead: Boolean(notification.isRead),
    createdAt: notification.createdAt || null,
    updatedAt: notification.updatedAt || null
  };
}

function sseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
  const unreadOnly = searchParams.get('unread') === 'true';
  const since = searchParams.get('since');
  const initialCursor = since ? new Date(since) : new Date(0);

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const cleanup = () => {
    if (pollTimer) clearInterval(pollTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    pollTimer = null;
    heartbeatTimer = null;
    closed = true;
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastCursor = Number.isNaN(initialCursor.getTime()) ? new Date(0) : initialCursor;

      const close = () => {
        if (closed) return;
        cleanup();
        try {
          controller.close();
        } catch {}
      };

      const pushSnapshot = async () => {
        const query: Record<string, unknown> = { user: user._id };
        if (unreadOnly) query.isRead = false;
        const [notifications, unreadCount] = await Promise.all([
          Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
          Notification.countDocuments({ user: user._id, isRead: false })
        ]);
        const normalized = notifications.map(serializeNotification);
        const newest = normalized
          .map((item) => new Date(item?.updatedAt || item?.createdAt || 0))
          .filter((date) => !Number.isNaN(date.getTime()))
          .sort((a, b) => b.getTime() - a.getTime())[0];
        if (newest) lastCursor = newest;
        controller.enqueue(sseEvent('snapshot', {
          notifications: normalized,
          unreadCount,
          cursor: lastCursor.toISOString()
        }));
      };

      const pushDelta = async () => {
        const query: Record<string, unknown> = {
          user: user._id,
          updatedAt: { $gt: lastCursor }
        };
        if (unreadOnly) query.isRead = false;

        const updates = await Notification.find(query)
          .sort({ updatedAt: 1, createdAt: 1 })
          .limit(limit)
          .lean();
        if (updates.length === 0) return;

        const normalized = updates.map(serializeNotification);
        const newest = normalized
          .map((item) => new Date(item?.updatedAt || item?.createdAt || 0))
          .filter((date) => !Number.isNaN(date.getTime()))
          .sort((a, b) => b.getTime() - a.getTime())[0];
        if (newest) lastCursor = newest;

        const unreadCount = await Notification.countDocuments({ user: user._id, isRead: false });
        controller.enqueue(sseEvent('notifications', {
          notifications: normalized,
          unreadCount,
          cursor: lastCursor.toISOString()
        }));
      };

      try {
        controller.enqueue(sseEvent('connected', {
          userId: user._id.toString(),
          at: new Date().toISOString()
        }));
        await pushSnapshot();
      } catch (error) {
        controller.enqueue(sseEvent('error', {
          message: 'Failed to initialize notification stream'
        }));
        close();
        return;
      }

      pollTimer = setInterval(() => {
        if (closed) return;
        pushDelta().catch(() => {
          if (!closed) {
            try {
              controller.enqueue(sseEvent('error', { message: 'Notification stream polling failed' }));
            } catch {}
            close();
          }
        });
      }, STREAM_POLL_MS);

      heartbeatTimer = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(`: heartbeat ${new Date().toISOString()}\n\n`));
          } catch {
            close();
          }
        }
      }, HEARTBEAT_MS);
    },
    cancel() {
      cleanup();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}
