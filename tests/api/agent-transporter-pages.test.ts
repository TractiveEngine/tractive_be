import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTest, teardownTest } from '../setup/db';
import { createAuthenticatedRequest, getResponseJson } from '../setup/test-server';
import { createAgent, createBuyer, createOrder, createProduct, createReview, createTransporter, createTruck } from '../factories';
import FleetBooking from '@/models/fleetBooking';

describe('Agent and transporter self-service pages', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('returns agent own reviews from GET /api/reviews without agentId', async () => {
    const { user: agent } = await createAgent();
    const { user: buyer } = await createBuyer();
    await createReview({ agent: agent._id, buyer: buyer._id, rating: 4, comment: 'Solid service' });

    const req = createAuthenticatedRequest('http://localhost:3000/api/reviews', agent._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agent.email
    });
    const res = await import('@/app/api/reviews/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalReviews).toBe(1);
    expect(data.data.reviews.length).toBe(1);
  });

  it('returns transporter customers from bookings even before order assignment flow', async () => {
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer();
    const truck = await createTruck({ transporter: transporter._id } as any);

    await FleetBooking.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      amount: 5000,
      loadWeightKg: 1000,
      shipmentItems: [],
      wholeTruckOnly: true,
      status: 'confirmed'
    });

    const req = createAuthenticatedRequest('http://localhost:3000/api/transporters/customers', transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const res = await import('@/app/api/transporters/customers/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(1);
    expect(data.data[0].email).toBe(buyer.email);
  });

  it('returns agent customers from owned product orders', async () => {
    const { user: agent } = await createAgent({ email: 'agent-pages@example.com' });
    const { user: buyer } = await createBuyer({ email: 'buyer-pages@example.com' });
    const product = await createProduct({ owner: agent._id });
    await createOrder({ buyer: buyer._id, products: [{ product: product._id, quantity: 1 }], totalAmount: 1000 });

    const req = createAuthenticatedRequest('http://localhost:3000/api/customers', agent._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agent.email
    });
    const res = await import('@/app/api/customers/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.customers.length).toBe(1);
  });
});
