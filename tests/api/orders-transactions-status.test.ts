import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTest, teardownTest } from '../setup/db';
import { createBuyer, createAgent, createAdmin, createTransporter, createProduct, createOrder, createTransaction } from '../factories';
import { createAuthenticatedRequest, getResponseJson } from '../setup/test-server';
import { PATCH as patchOrderStatusHandler } from '@/app/api/orders/[id]/status/route';
import { GET as getOrderPartiesHandler } from '@/app/api/orders/[id]/parties/route';
import { PATCH as patchTransactionStatusHandler } from '@/app/api/transactions/[id]/status/route';
import { POST as contactCustomerCareHandler } from '@/app/api/transactions/[id]/contact-customer-care/route';
import SupportTicket from '@/models/supportTicket';
import Order from '@/models/order';

describe('Orders & Transactions status endpoints', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('allows agent to update order status and buyer cannot escalate to delivered', async () => {
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 2 }],
      totalAmount: 2000,
    });

    // Buyer tries to set delivered -> forbidden
    const buyerReq = createAuthenticatedRequest(
      `http://localhost:3000/api/orders/${order._id}/status`,
      buyer._id.toString(),
      { method: 'PATCH', body: { status: 'delivered' }, role: 'buyer', email: buyer.email }
    );
    const buyerRes = await patchOrderStatusHandler(buyerReq, { params: { id: order._id.toString() } });
    expect(buyerRes.status).toBe(403);

    // Agent updates to paid
    const agentReq = createAuthenticatedRequest(
      `http://localhost:3000/api/orders/${order._id}/status`,
      agent._id.toString(),
      { method: 'PATCH', body: { status: 'paid' }, role: 'agent', email: agent.email }
    );
    const agentRes = await patchOrderStatusHandler(agentReq, { params: { id: order._id.toString() } });
    const agentData = await getResponseJson(agentRes);
    expect(agentRes.status).toBe(200);
    expect(agentData.success).toBe(true);
    expect(agentData.data.status).toBe('paid');
  });

  it('returns order parties to authorized users', async () => {
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 1000,
    });

    const buyerReq = createAuthenticatedRequest(
      `http://localhost:3000/api/orders/${order._id}/parties`,
      buyer._id.toString(),
      { method: 'GET', role: 'buyer', email: buyer.email }
    );
    const res = await getOrderPartiesHandler(buyerReq, { params: { id: order._id.toString() } });
    const data = await getResponseJson(res);
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.buyer.email).toBe(buyer.email);
    expect(data.data.seller).toBeTruthy();
  });

  it('allows admin to update transaction status and sets order paid', async () => {
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const { user: admin } = await createAdmin();
    const product = await createProduct({ owner: agent._id });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 5000,
    });
    const tx = await createTransaction({ order: order._id, buyer: buyer._id, amount: 5000, status: 'pending' });

    const adminReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transactions/${tx._id}/status`,
      admin._id.toString(),
      { method: 'PATCH', body: { status: 'approved' }, role: 'admin', email: admin.email }
    );
    const res = await patchTransactionStatusHandler(adminReq, { params: { id: tx._id.toString() } });
    const data = await getResponseJson(res);
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('approved');

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder?.status).toBe('paid');
  });

  it('creates support ticket via contact-customer-care', async () => {
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 1000,
    });
    const tx = await createTransaction({ order: order._id, buyer: buyer._id, amount: 1000, status: 'pending' });

    const req = createAuthenticatedRequest(
      `http://localhost:3000/api/transactions/${tx._id}/contact-customer-care`,
      buyer._id.toString(),
      { method: 'POST', body: { message: 'Need help' }, role: 'buyer', email: buyer.email }
    );
    const res = await contactCustomerCareHandler(req, { params: { id: tx._id.toString() } });
    const data = await getResponseJson(res);
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    const ticketCount = await SupportTicket.countDocuments({ linkedTransaction: tx._id });
    expect(ticketCount).toBe(1);
  });
});
