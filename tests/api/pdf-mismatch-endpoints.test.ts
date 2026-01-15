import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTest, teardownTest } from '../setup/db';
import { createAuthenticatedRequest, getResponseJson } from '../setup/test-server';
import { createAdmin, createBuyer, createTransporter, createAgent, createProduct, createOrder, createTransaction, createReview, createTruck } from '../factories';

describe('PDF-aligned endpoints', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('admin updates user status via /admin/users/:id/status', async () => {
    const { user: admin } = await createAdmin();
    const { user: buyer } = await createBuyer();

    const req = createAuthenticatedRequest(
      `http://localhost:3000/api/admin/users/${buyer._id}/status`,
      admin._id.toString(),
      { method: 'PATCH', body: { status: 'suspended' }, role: 'admin', email: admin.email }
    );
    const res = await import('@/app/api/admin/users/[id]/status/route').then((m) =>
      m.PATCH(req, { params: { id: buyer._id.toString() } })
    );
    const data = await getResponseJson(res as unknown as Response);
    expect((res as Response).status).toBe(200);
    expect(data.data.status).toBe('suspended');
  });

  it('admin refunds transaction via /admin/transactions/:id/refund', async () => {
    const { user: admin } = await createAdmin();
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 1000,
    });
    const tx = await createTransaction({ order: order._id, buyer: buyer._id, status: 'approved', amount: 1000 });

    const req = createAuthenticatedRequest(
      `http://localhost:3000/api/admin/transactions/${tx._id}/refund`,
      admin._id.toString(),
      { method: 'POST', body: { reason: 'Duplicate' }, role: 'admin', email: admin.email }
    );
    const res = await import('@/app/api/admin/transactions/[id]/refund/route').then((m) =>
      m.POST(req, { params: { id: tx._id.toString() } })
    );
    const data = await getResponseJson(res as unknown as Response);
    expect((res as Response).status).toBe(200);
    expect(data.data.status).toBe('refunded');
  });

  it('buyer can list transporters and view transporter details', async () => {
    const { user: buyer } = await createBuyer();
    const { user: transporter } = await createTransporter();

    const listReq = createAuthenticatedRequest('http://localhost:3000/api/transporters', buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email,
    });
    const listRes = await import('@/app/api/transporters/route').then((m) => m.GET(listReq));
    const listData = await getResponseJson(listRes as unknown as Response);
    expect(listData.data.length).toBeGreaterThan(0);

    const getReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/${transporter._id}`,
      buyer._id.toString(),
      { method: 'GET', role: 'buyer', email: buyer.email }
    );
    const getRes = await import('@/app/api/transporters/[id]/route').then((m) =>
      m.GET(getReq, { params: { id: transporter._id.toString() } })
    );
    const getData = await getResponseJson(getRes as unknown as Response);
    expect(getData.data._id.toString()).toBe(transporter._id.toString());
  });

  it('buyer can view transporter trucks with filters', async () => {
    const { user: buyer } = await createBuyer();
    const { user: transporter } = await createTransporter();
    await createTruck({ transporter: transporter._id, status: 'available' } as any);

    const req = createAuthenticatedRequest('http://localhost:3000/api/transporters/trucks?status=empty', buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email,
    });
    const res = await import('@/app/api/transporters/trucks/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('agent can reply to review and buyer can like it', async () => {
    const { user: agent } = await createAgent();
    const { user: buyer } = await createBuyer();
    const review = await createReview({ agent: agent._id, buyer: buyer._id });

    const replyReq = createAuthenticatedRequest(
      `http://localhost:3000/api/reviews/${review._id}/reply`,
      agent._id.toString(),
      { method: 'POST', body: { message: 'Thanks!' }, role: 'agent', email: agent.email }
    );
    const replyRes = await import('@/app/api/reviews/[id]/reply/route').then((m) =>
      m.POST(replyReq, { params: { id: review._id.toString() } })
    );
    const replyData = await getResponseJson(replyRes as unknown as Response);
    expect(replyData.data.reply.message).toBe('Thanks!');

    const likeReq = createAuthenticatedRequest(
      `http://localhost:3000/api/reviews/${review._id}/like`,
      buyer._id.toString(),
      { method: 'POST', role: 'buyer', email: buyer.email }
    );
    const likeRes = await import('@/app/api/reviews/[id]/like/route').then((m) =>
      m.POST(likeReq, { params: { id: review._id.toString() } })
    );
    const likeData = await getResponseJson(likeRes as unknown as Response);
    expect(likeData.data.likesCount).toBe(1);
  });

  it('transporter can update transaction status for assigned order', async () => {
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer();
    const product = await createProduct({ owner: transporter._id });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 1000,
      transporter: transporter._id,
    });
    const tx = await createTransaction({ order: order._id, buyer: buyer._id, status: 'pending' });

    const req = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/transactions/${tx._id}/status`,
      transporter._id.toString(),
      { method: 'PATCH', body: { status: 'approved' }, role: 'transporter', email: transporter.email }
    );
    const res = await import('@/app/api/transporters/transactions/[id]/status/route').then((m) =>
      m.PATCH(req, { params: { id: tx._id.toString() } })
    );
    const data = await getResponseJson(res as unknown as Response);
    expect(data.data.status).toBe('approved');
  });

  it('creates or reuses customer chat', async () => {
    const { user: admin } = await createAdmin();
    const { user: buyer } = await createBuyer();

    const req = createAuthenticatedRequest(
      `http://localhost:3000/api/customers/${buyer._id}/chat`,
      admin._id.toString(),
      { method: 'POST', body: { initialMessage: 'Hello' }, role: 'admin', email: admin.email }
    );
    const res = await import('@/app/api/customers/[id]/chat/route').then((m) =>
      m.POST(req, { params: { id: buyer._id.toString() } })
    );
    const data = await getResponseJson(res as unknown as Response);
    expect(data.data.conversationId).toBeTruthy();

    const res2 = await import('@/app/api/customers/[id]/chat/route').then((m) =>
      m.POST(req, { params: { id: buyer._id.toString() } })
    );
    const data2 = await getResponseJson(res2 as unknown as Response);
    expect(data2.data.conversationId).toBe(data.data.conversationId);
  });
});
