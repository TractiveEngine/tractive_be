import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTest, teardownTest } from '../setup/db';
import { createAuthenticatedRequest, getResponseJson } from '../setup/test-server';
import { createTransporter, createBuyer, createProduct, createOrder, createNegotiationOffer, createShippingRequest } from '../factories';

describe('Transporter operations namespace', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('manages fleet CRUD with status', async () => {
    const { user: transporter } = await createTransporter();

    // Create
    const createReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/fleet', transporter._id.toString(), {
      method: 'POST',
      body: { plateNumber: 'ABC-123', model: 'Volvo', capacity: '10T' },
      role: 'transporter',
      email: transporter.email,
    });
    const createRes = await import('@/app/api/transporters/fleet/route').then((m) => m.POST(createReq));
    const createData = await getResponseJson(createRes as unknown as Response);
    expect((createRes as Response).status).toBe(201);
    const truckId = createData.data._id;

    // Update
    const patchReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/fleet/${truckId}`,
      transporter._id.toString(),
      { method: 'PATCH', body: { model: 'MAN' }, role: 'transporter', email: transporter.email }
    );
    const patchRes = await import('@/app/api/transporters/fleet/[id]/route').then((m) => m.PATCH(patchReq, { params: { id: truckId } }));
    expect((patchRes as Response).status).toBe(200);

    // Status
    const statusReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/fleet/${truckId}/status`,
      transporter._id.toString(),
      { method: 'PATCH', body: { status: 'under_maintenance' }, role: 'transporter', email: transporter.email }
    );
    const statusRes = await import('@/app/api/transporters/fleet/[id]/status/route').then((m) =>
      m.PATCH(statusReq, { params: { id: truckId } })
    );
    const statusData = await getResponseJson(statusRes as unknown as Response);
    expect(statusData.data.status).toBe('under_maintenance');

    // Delete
    const deleteReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/fleet/${truckId}`,
      transporter._id.toString(),
      { method: 'DELETE', role: 'transporter', email: transporter.email }
    );
    const deleteRes = await import('@/app/api/transporters/fleet/[id]/route').then((m) => m.DELETE(deleteReq, { params: { id: truckId } }));
    expect((deleteRes as Response).status).toBe(200);
  });

  it('manages drivers and assigns fleet', async () => {
    const { user: transporter } = await createTransporter();

    const truckReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/fleet', transporter._id.toString(), {
      method: 'POST',
      body: { plateNumber: 'XYZ-999' },
      role: 'transporter',
      email: transporter.email,
    });
    const truckRes = await import('@/app/api/transporters/fleet/route').then((m) => m.POST(truckReq));
    const truckData = await getResponseJson(truckRes as unknown as Response);

    const driverReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/drivers', transporter._id.toString(), {
      method: 'POST',
      body: { name: 'John Driver', licenseNumber: 'LIC123' },
      role: 'transporter',
      email: transporter.email,
    });
    const driverRes = await import('@/app/api/transporters/drivers/route').then((m) => m.POST(driverReq));
    const driverData = await getResponseJson(driverRes as unknown as Response);

    const assignReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/drivers/${driverData.data._id}/assign-fleet`,
      transporter._id.toString(),
      { method: 'POST', body: { truckId: truckData.data._id }, role: 'transporter', email: transporter.email }
    );
    const assignRes = await import('@/app/api/transporters/drivers/[id]/assign-fleet/route').then((m) =>
      m.POST(assignReq, { params: { id: driverData.data._id } })
    );
    const assignData = await getResponseJson(assignRes as unknown as Response);
    expect(assignData.success).toBe(true);
    expect(assignData.data.driver.assignedTruck.toString()).toBe(truckData.data._id.toString());
  });

  it('allows transporter to update order transport status and view buyer/product', async () => {
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer();
    const product = await createProduct({ owner: transporter._id });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 1000,
      transporter: transporter._id,
    });

    const statusReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/orders/${order._id}/status`,
      transporter._id.toString(),
      { method: 'PATCH', body: { transportStatus: 'on_transit' }, role: 'transporter', email: transporter.email }
    );
    const statusRes = await import('@/app/api/transporters/orders/[orderId]/status/route').then((m) =>
      m.PATCH(statusReq, { params: { orderId: order._id.toString() } })
    );
    const statusData = await getResponseJson(statusRes as unknown as Response);
    expect(statusData.data.transportStatus).toBe('on_transit');

    const buyerReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/orders/${order._id}/buyer`,
      transporter._id.toString(),
      { method: 'GET', role: 'transporter', email: transporter.email }
    );
    const buyerRes = await import('@/app/api/transporters/orders/[orderId]/buyer/route').then((m) =>
      m.GET(buyerReq, { params: { orderId: order._id.toString() } })
    );
    const buyerData = await getResponseJson(buyerRes as unknown as Response);
    expect(buyerData.data.email).toBe(buyer.email);

    const productReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/orders/${order._id}/product`,
      transporter._id.toString(),
      { method: 'GET', role: 'transporter', email: transporter.email }
    );
    const productRes = await import('@/app/api/transporters/orders/[orderId]/product/route').then((m) =>
      m.GET(productReq, { params: { orderId: order._id.toString() } })
    );
    const productData = await getResponseJson(productRes as unknown as Response);
    expect(productData.data.length).toBe(1);

    const trackingReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/orders/${order._id}/tracking`,
      transporter._id.toString(),
      { method: 'GET', role: 'transporter', email: transporter.email }
    );
    const trackingRes = await import('@/app/api/transporters/orders/[orderId]/tracking/route').then((m) =>
      m.GET(trackingReq, { params: { orderId: order._id.toString() } })
    );
    const trackingData = await getResponseJson(trackingRes as unknown as Response);
    expect(trackingData.data.timeline.length).toBeGreaterThan(0);
  });

  it('lists and responds to negotiations', async () => {
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer();
    const product = await createProduct({ owner: transporter._id });
    const shipping = await createShippingRequest({ buyer: buyer._id, product: product._id });
    const negotiation = await createNegotiationOffer({ shippingRequest: shipping._id, transporter: transporter._id });

    const listReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/negotiations', transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email,
    });
    const listRes = await import('@/app/api/transporters/negotiations/route').then((m) => m.GET(listReq));
    const listData = await getResponseJson(listRes as unknown as Response);
    expect(listData.data.length).toBeGreaterThan(0);

    const respondReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/negotiations/${negotiation._id}/respond`,
      transporter._id.toString(),
      { method: 'POST', body: { action: 'accept' }, role: 'transporter', email: transporter.email }
    );
    const respondRes = await import('@/app/api/transporters/negotiations/[id]/respond/route').then((m) =>
      m.POST(respondReq, { params: { id: negotiation._id.toString() } })
    );
    const respondData = await getResponseJson(respondRes as unknown as Response);
    expect(respondData.data.negotiationStatus).toBe('accepted');
  });
});
