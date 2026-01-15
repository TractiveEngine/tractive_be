import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTest, teardownTest } from '../setup/db';
import { createAuthenticatedRequest, createMockRequest, getResponseJson } from '../setup/test-server';
import { createAdmin, createBuyer } from '../factories';
import { POST as helpCreate } from '@/app/api/help/route';
import Conversation from '@/models/conversation';

describe('Admin support and live chats', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('manages support tickets lifecycle', async () => {
    const { user: buyer } = await createBuyer();
    const { user: admin } = await createAdmin();

    // User creates ticket
    const userReq = createAuthenticatedRequest('http://localhost:3000/api/help', buyer._id.toString(), {
      method: 'POST',
      body: { subject: 'Need help', message: 'Support me' },
      role: 'buyer',
      email: buyer.email,
    });
    const createRes = await helpCreate(userReq);
    const createData = await getResponseJson(createRes as unknown as Response);
    const ticketId = createData.data._id;

    // Admin lists
    const listReq = createAuthenticatedRequest('http://localhost:3000/api/admin/queries', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email,
    });
    const listRes = await import('@/app/api/admin/queries/route').then((m) => m.GET(listReq));
    expect((listRes as Response).status).toBe(200);

    // Admin status update
    const statusReq = createAuthenticatedRequest(
      `http://localhost:3000/api/admin/queries/${ticketId}/status`,
      admin._id.toString(),
      { method: 'PATCH', body: { status: 'in_progress' }, role: 'admin', email: admin.email }
    );
    const statusRes = await import('@/app/api/admin/queries/[id]/status/route').then((m) =>
      m.PATCH(statusReq, { params: { id: ticketId } })
    );
    const statusData = await getResponseJson(statusRes as unknown as Response);
    expect(statusData.data.status).toBe('in_progress');

    // Admin reply
    const replyReq = createAuthenticatedRequest(
      `http://localhost:3000/api/admin/queries/${ticketId}/reply`,
      admin._id.toString(),
      { method: 'POST', body: { reply: 'We are on it' }, role: 'admin', email: admin.email }
    );
    const replyRes = await import('@/app/api/admin/queries/[id]/reply/route').then((m) =>
      m.POST(replyReq, { params: { id: ticketId } })
    );
    expect((replyRes as Response).status).toBe(200);

    // Admin delete
    const deleteReq = createAuthenticatedRequest(
      `http://localhost:3000/api/admin/queries/${ticketId}`,
      admin._id.toString(),
      { method: 'DELETE', role: 'admin', email: admin.email }
    );
    const deleteRes = await import('@/app/api/admin/queries/[id]/route').then((m) => m.DELETE(deleteReq, { params: { id: ticketId } }));
    expect((deleteRes as Response).status).toBe(200);
  });

  it('allows admin to manage live chats', async () => {
    const { user: buyer } = await createBuyer();
    const { user: admin } = await createAdmin();

    // Create a conversation as buyer using chat POST
    const convReq = createAuthenticatedRequest('http://localhost:3000/api/chat', buyer._id.toString(), {
      method: 'POST',
      body: { initialMessage: 'Hello' },
      role: 'buyer',
      email: buyer.email,
    });
    await import('@/app/api/chat/route').then((m) => m.POST(convReq));
    const conversation = await Conversation.findOne({ participants: buyer._id });

    // Admin list live chats
    const listReq = createAuthenticatedRequest('http://localhost:3000/api/admin/live-chats', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email,
    });
    const listRes = await import('@/app/api/admin/live-chats/route').then((m) => m.GET(listReq));
    expect((listRes as Response).status).toBe(200);

    // Admin post message
    const msgReq = createAuthenticatedRequest(
      `http://localhost:3000/api/admin/live-chats/${conversation?._id}/messages`,
      admin._id.toString(),
      { method: 'POST', body: { text: 'Admin here' }, role: 'admin', email: admin.email }
    );
    const msgRes = await import('@/app/api/admin/live-chats/[conversationId]/messages/route').then((m) =>
      m.POST(msgReq, { params: { conversationId: conversation?._id.toString() || '' } })
    );
    expect((msgRes as Response).status).toBe(201);

    // Admin close
    const closeReq = createAuthenticatedRequest(
      `http://localhost:3000/api/admin/live-chats/${conversation?._id}/close`,
      admin._id.toString(),
      { method: 'PATCH', role: 'admin', email: admin.email }
    );
    const closeRes = await import('@/app/api/admin/live-chats/[conversationId]/close/route').then((m) =>
      m.PATCH(closeReq, { params: { conversationId: conversation?._id.toString() || '' } })
    );
    expect((closeRes as Response).status).toBe(200);

    // Admin delete conversation
    const delReq = createAuthenticatedRequest(
      `http://localhost:3000/api/admin/live-chats/${conversation?._id}`,
      admin._id.toString(),
      { method: 'DELETE', role: 'admin', email: admin.email }
    );
    const delRes = await import('@/app/api/admin/live-chats/[conversationId]/route').then((m) =>
      m.DELETE(delReq, { params: { conversationId: conversation?._id.toString() || '' } })
    );
    expect((delRes as Response).status).toBe(200);
  });
});
