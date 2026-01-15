import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { setupTest, teardownTest } from '../setup/db';
import { createAuthenticatedRequest, createMockRequest, getResponseJson } from '../setup/test-server';
import {
  createAdmin,
  createAgent,
  createBuyer,
  createFarmer,
  createNotification,
  createSupportTicket,
  createTransporter,
  createTruck,
  createReview,
  createUser
} from '../factories';
import Conversation from '@/models/conversation';
import Message from '@/models/message';

describe('Alias endpoints parity', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('admin can approve agent and farmer by id', async () => {
    const { user: admin } = await createAdmin();
    const { user: agent } = await createUser({ roles: ['agent'], activeRole: 'agent', agentApprovalStatus: 'pending' });
    const { user: agentOwner } = await createAgent();
    const farmer = await createFarmer({ createdBy: agentOwner._id, approvalStatus: 'pending' });

    const agentReq = createAuthenticatedRequest(
      `http://localhost:3000/api/admin/approvals/agents/${agent._id}`,
      admin._id.toString(),
      { method: 'PATCH', body: { status: 'approved' }, role: 'admin', email: admin.email }
    );
    const agentRes = await import('@/app/api/admin/approvals/agents/[id]/route').then((m) =>
      m.PATCH(agentReq, { params: { id: agent._id.toString() } })
    );
    const agentData = await getResponseJson(agentRes as unknown as Response);
    expect((agentRes as Response).status).toBe(200);
    expect(agentData.data.agentApprovalStatus).toBe('approved');

    const farmerReq = createAuthenticatedRequest(
      `http://localhost:3000/api/admin/approvals/farmers/${farmer._id}`,
      admin._id.toString(),
      { method: 'PATCH', body: { status: 'approved' }, role: 'admin', email: admin.email }
    );
    const farmerRes = await import('@/app/api/admin/approvals/farmers/[id]/route').then((m) =>
      m.PATCH(farmerReq, { params: { id: farmer._id.toString() } })
    );
    const farmerData = await getResponseJson(farmerRes as unknown as Response);
    expect((farmerRes as Response).status).toBe(200);
    expect(farmerData.data.approvalStatus).toBe('approved');
  });

  it('notification read alias marks read', async () => {
    const { user: buyer } = await createBuyer();
    const notification = await createNotification({ user: buyer._id, isRead: false });

    const req = createAuthenticatedRequest(
      `http://localhost:3000/api/notifications/${notification._id}/read`,
      buyer._id.toString(),
      { method: 'PATCH', role: 'buyer', email: buyer.email }
    );
    const res = await import('@/app/api/notifications/[id]/read/route').then((m) =>
      m.PATCH(req, { params: { id: notification._id.toString() } })
    );
    const data = await getResponseJson(res as unknown as Response);
    expect((res as Response).status).toBe(200);
    expect(data.data.isRead).toBe(true);
  });

  it('help delete by id closes ticket', async () => {
    const { user: buyer } = await createBuyer();
    const ticket = await createSupportTicket({ user: buyer._id, status: 'open' });

    const req = createAuthenticatedRequest(
      `http://localhost:3000/api/help/${ticket._id}`,
      buyer._id.toString(),
      { method: 'DELETE', role: 'buyer', email: buyer.email }
    );
    const res = await import('@/app/api/help/[id]/route').then((m) =>
      m.DELETE(req, { params: { id: ticket._id.toString() } })
    );
    const data = await getResponseJson(res as unknown as Response);
    expect((res as Response).status).toBe(200);
    expect(data.data.status).toBe('closed');
  });

  it('chat message patch/delete works for participants', async () => {
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const conversation = await Conversation.create({ participants: [buyer._id, agent._id] });
    const message = await Message.create({ conversation: conversation._id, sender: buyer._id, text: 'Hello', readBy: [buyer._id] });

    const patchReq = createAuthenticatedRequest(
      `http://localhost:3000/api/chat/${conversation._id}/messages/${message._id}`,
      buyer._id.toString(),
      { method: 'PATCH', body: { text: 'Updated' }, role: 'buyer', email: buyer.email }
    );
    const patchRes = await import('@/app/api/chat/[conversationId]/messages/[messageId]/route').then((m) =>
      m.PATCH(patchReq, { params: { conversationId: conversation._id.toString(), messageId: message._id.toString() } })
    );
    const patchData = await getResponseJson(patchRes as unknown as Response);
    expect(patchData.data.text).toBe('Updated');

    const deleteReq = createAuthenticatedRequest(
      `http://localhost:3000/api/chat/${conversation._id}/messages/${message._id}`,
      buyer._id.toString(),
      { method: 'DELETE', role: 'buyer', email: buyer.email }
    );
    const deleteRes = await import('@/app/api/chat/[conversationId]/messages/[messageId]/route').then((m) =>
      m.DELETE(deleteReq, { params: { conversationId: conversation._id.toString(), messageId: message._id.toString() } })
    );
    expect((deleteRes as Response).status).toBe(200);

    const deleted = await Message.findById(message._id);
    expect(deleted).toBeNull();
  });

  it('transporter trucks subroutes and recommendations resolve', async () => {
    const { user: buyer } = await createBuyer();
    const { user: transporter } = await createTransporter();
    const truckAvailable = await createTruck({ transporter: transporter._id, status: 'available' } as any);
    await createTruck({ transporter: transporter._id, status: 'on_transit' } as any);
    await createReview({ agent: transporter._id, buyer: buyer._id, rating: 5 });

    const emptyReq = createAuthenticatedRequest(
      'http://localhost:3000/api/transporters/trucks/empty',
      buyer._id.toString(),
      { method: 'GET', role: 'buyer', email: buyer.email }
    );
    const emptyRes = await import('@/app/api/transporters/trucks/empty/route').then((m) => m.GET(emptyReq));
    const emptyData = await getResponseJson(emptyRes as unknown as Response);
    expect(emptyData.data.length).toBeGreaterThan(0);

    const almostReq = createAuthenticatedRequest(
      'http://localhost:3000/api/transporters/trucks/almost-full',
      buyer._id.toString(),
      { method: 'GET', role: 'buyer', email: buyer.email }
    );
    const almostRes = await import('@/app/api/transporters/trucks/almost-full/route').then((m) => m.GET(almostReq));
    const almostData = await getResponseJson(almostRes as unknown as Response);
    expect(almostData.data.length).toBeGreaterThan(0);

    const truckReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/trucks/${truckAvailable._id}`,
      buyer._id.toString(),
      { method: 'GET', role: 'buyer', email: buyer.email }
    );
    const truckRes = await import('@/app/api/transporters/trucks/[id]/route').then((m) =>
      m.GET(truckReq, { params: { id: truckAvailable._id.toString() } })
    );
    const truckData = await getResponseJson(truckRes as unknown as Response);
    expect(truckData.data._id.toString()).toBe(truckAvailable._id.toString());

    const recReq = createAuthenticatedRequest(
      'http://localhost:3000/api/transporters/recommendations',
      buyer._id.toString(),
      { method: 'GET', role: 'buyer', email: buyer.email }
    );
    const recRes = await import('@/app/api/transporters/recommendations/route').then((m) => m.GET(recReq));
    const recData = await getResponseJson(recRes as unknown as Response);
    expect(recData.data.length).toBeGreaterThan(0);

    const reviewsReq = createAuthenticatedRequest(
      'http://localhost:3000/api/transporters/reviews',
      transporter._id.toString(),
      { method: 'GET', role: 'transporter', email: transporter.email }
    );
    const reviewsRes = await import('@/app/api/transporters/reviews/route').then((m) => m.GET(reviewsReq));
    const reviewsData = await getResponseJson(reviewsRes as unknown as Response);
    expect(reviewsData.data.length).toBeGreaterThan(0);
  });

  it('admin can onboard user and list by profession', async () => {
    const { user: admin } = await createAdmin();
    const { user: buyer } = await createBuyer({ status: 'removed' });

    const onboardReq = createAuthenticatedRequest(
      `http://localhost:3000/api/admin/users/${buyer._id}/onboard`,
      admin._id.toString(),
      { method: 'POST', role: 'admin', email: admin.email }
    );
    const onboardRes = await import('@/app/api/admin/users/[id]/onboard/route').then((m) =>
      m.POST(onboardReq, { params: { id: buyer._id.toString() } })
    );
    const onboardData = await getResponseJson(onboardRes as unknown as Response);
    expect(onboardData.data.status).toBe('active');

    const listReq = createAuthenticatedRequest(
      'http://localhost:3000/api/admin/users/buyer',
      admin._id.toString(),
      { method: 'GET', role: 'admin', email: admin.email }
    );
    const listRes = await import('@/app/api/admin/users/[id]/route').then((m) =>
      m.GET(listReq, { params: { id: 'buyer' } })
    );
    const listData = await getResponseJson(listRes as unknown as Response);
    expect(listData.data.users.length).toBeGreaterThan(0);
  });

  it('admin or agent can list customers', async () => {
    const { user: admin } = await createAdmin();
    await createBuyer();

    const req = createAuthenticatedRequest('http://localhost:3000/api/customers', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const res = await import('@/app/api/customers/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);
    expect(data.data.customers.length).toBeGreaterThan(0);
  });

  it('rejects unauthorized access for new endpoints', async () => {
    const conversationId = new mongoose.Types.ObjectId().toString();
    const messageId = new mongoose.Types.ObjectId().toString();
    const objId = new mongoose.Types.ObjectId().toString();

    const cases: Array<Promise<Response>> = [
      import('@/app/api/admin/approvals/agents/[id]/route').then((m) =>
        m.PATCH(createMockRequest(`http://localhost:3000/api/admin/approvals/agents/${objId}`, { method: 'PATCH' }), { params: { id: objId } })
      ),
      import('@/app/api/admin/approvals/farmers/[id]/route').then((m) =>
        m.PATCH(createMockRequest(`http://localhost:3000/api/admin/approvals/farmers/${objId}`, { method: 'PATCH' }), { params: { id: objId } })
      ),
      import('@/app/api/notifications/[id]/read/route').then((m) =>
        m.PATCH(createMockRequest(`http://localhost:3000/api/notifications/${objId}/read`, { method: 'PATCH' }), { params: { id: objId } })
      ),
      import('@/app/api/help/[id]/route').then((m) =>
        m.DELETE(createMockRequest(`http://localhost:3000/api/help/${objId}`, { method: 'DELETE' }), { params: { id: objId } })
      ),
      import('@/app/api/chat/[conversationId]/messages/[messageId]/route').then((m) =>
        m.PATCH(createMockRequest(`http://localhost:3000/api/chat/${conversationId}/messages/${messageId}`, { method: 'PATCH' }), { params: { conversationId, messageId } })
      ),
      import('@/app/api/chat/[conversationId]/messages/[messageId]/route').then((m) =>
        m.DELETE(createMockRequest(`http://localhost:3000/api/chat/${conversationId}/messages/${messageId}`, { method: 'DELETE' }), { params: { conversationId, messageId } })
      ),
      import('@/app/api/transporters/trucks/empty/route').then((m) =>
        m.GET(createMockRequest('http://localhost:3000/api/transporters/trucks/empty', { method: 'GET' }))
      ),
      import('@/app/api/transporters/trucks/almost-full/route').then((m) =>
        m.GET(createMockRequest('http://localhost:3000/api/transporters/trucks/almost-full', { method: 'GET' }))
      ),
      import('@/app/api/transporters/trucks/[id]/route').then((m) =>
        m.GET(createMockRequest(`http://localhost:3000/api/transporters/trucks/${objId}`, { method: 'GET' }), { params: { id: objId } })
      ),
      import('@/app/api/transporters/recommendations/route').then((m) =>
        m.GET(createMockRequest('http://localhost:3000/api/transporters/recommendations', { method: 'GET' }))
      ),
      import('@/app/api/transporters/reviews/route').then((m) =>
        m.GET(createMockRequest('http://localhost:3000/api/transporters/reviews', { method: 'GET' }))
      ),
      import('@/app/api/admin/users/[id]/onboard/route').then((m) =>
        m.POST(createMockRequest(`http://localhost:3000/api/admin/users/${objId}/onboard`, { method: 'POST' }), { params: { id: objId } })
      ),
      import('@/app/api/admin/users/[id]/route').then((m) =>
        m.GET(createMockRequest('http://localhost:3000/api/admin/users/buyer', { method: 'GET' }), { params: { id: 'buyer' } })
      ),
      import('@/app/api/customers/route').then((m) =>
        m.GET(createMockRequest('http://localhost:3000/api/customers', { method: 'GET' }))
      )
    ];

    const results = await Promise.all(cases);
    for (const res of results) {
      expect(res.status).toBe(401);
    }
  });
});
