import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTest, teardownTest } from '../setup/db';
import { createAuthenticatedRequest, getResponseJson } from '../setup/test-server';
import {
  createAdmin,
  createAgent,
  createBid,
  createBuyer,
  createOrder,
  createProduct,
  createTransaction,
  createTransporter
} from '../factories';

describe('Frontend integration gap fixes', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('paginates buyer biddings', async () => {
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id });
    await createBid({ product: product._id, buyer: buyer._id, agent: agent._id, amount: 1000 });
    await createBid({ product: product._id, buyer: buyer._id, agent: agent._id, amount: 2000 });

    const req = createAuthenticatedRequest('http://localhost:3000/api/buyers/biddings?page=1&limit=1', buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email
    });
    const res = await import('@/app/api/buyers/biddings/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.data.length).toBe(1);
    expect(data.pagination.total).toBe(2);
    expect(data.pagination.totalPages).toBe(2);
  });

  it('returns product details in admin transactions list', async () => {
    const { user: admin } = await createAdmin();
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id, name: 'Premium Rice', images: ['https://example.com/rice.png'] });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 3 }],
      totalAmount: 9000
    });
    await createTransaction({ order: order._id, buyer: buyer._id, amount: 9000, status: 'approved' });

    const req = createAuthenticatedRequest('http://localhost:3000/api/admin/transactions?status=approved', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const res = await import('@/app/api/admin/transactions/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.data.transactions.length).toBe(1);
    expect(data.data.transactions[0].products[0].name).toBe('Premium Rice');
    expect(data.data.transactions[0].products[0].images[0]).toBe('https://example.com/rice.png');
  });

  it('filters and paginates transporter transactions', async () => {
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id });
    const orderA = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 1000,
      transporter: transporter._id
    });
    const orderB = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 2 }],
      totalAmount: 2000,
      transporter: transporter._id
    });
    await createTransaction({ order: orderA._id, buyer: buyer._id, amount: 1000, status: 'pending' });
    await createTransaction({ order: orderB._id, buyer: buyer._id, amount: 2000, status: 'approved' });

    const req = createAuthenticatedRequest('http://localhost:3000/api/transporters/transactions?status=pending&page=1&limit=10', transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const res = await import('@/app/api/transporters/transactions/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.data.length).toBe(1);
    expect(data.data[0].status).toBe('pending');
    expect(data.pagination.total).toBe(1);
  });

  it('scopes customers to agent-owned buyers', async () => {
    const { user: agentA } = await createAgent({ email: 'agentA-customers@example.com' });
    const { user: agentB } = await createAgent({ email: 'agentB-customers@example.com' });
    const { user: buyerA } = await createBuyer({ email: 'buyerA-customers@example.com' });
    const { user: buyerB } = await createBuyer({ email: 'buyerB-customers@example.com' });
    const productA = await createProduct({ owner: agentA._id });
    const productB = await createProduct({ owner: agentB._id });

    await createOrder({ buyer: buyerA._id, products: [{ product: productA._id, quantity: 1 }], totalAmount: 1000 });
    await createOrder({ buyer: buyerB._id, products: [{ product: productB._id, quantity: 1 }], totalAmount: 1000 });

    const req = createAuthenticatedRequest('http://localhost:3000/api/customers', agentA._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agentA.email
    });
    const res = await import('@/app/api/customers/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.data.customers.length).toBe(1);
    expect(data.data.customers[0].email).toBe('buyera-customers@example.com');
    expect(data.data.customers[0].ordersCount).toBe(1);
  });
});
