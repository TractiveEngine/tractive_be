import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { setupTest, teardownTest } from '../setup/db';
import { createAuthenticatedRequest, getResponseJson } from '../setup/test-server';
import {
  createAdmin,
  createAgent,
  createBuyer,
  createUser,
  createOrder,
  createProduct,
  createReview,
  createShippingRequest,
  createTransaction,
  createTransporter,
  createTruck,
  createWishlistItem
} from '../factories';
import Transaction from '@/models/transaction';
import FleetBooking from '@/models/fleetBooking';
import FleetTrip from '@/models/fleetTrip';
import User from '@/models/user';

describe('UI call follow-up fixes', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('returns agent-scoped transactions from GET /api/transactions', async () => {
    const { user: agent } = await createAgent();
    const { user: buyer } = await createBuyer();
    const product = await createProduct({ owner: agent._id, name: 'Agent Product' });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 2 }],
      totalAmount: 5000,
      status: 'paid'
    });
    await createTransaction({ order: order._id, buyer: buyer._id, amount: 5000, status: 'approved' });

    const req = createAuthenticatedRequest('http://localhost:3000/api/transactions?status=approved&page=1&limit=10', agent._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agent.email
    });
    const res = await import('@/app/api/transactions/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(1);
    expect(data.data[0].status).toBe('approved');
  });

  it('returns agent-scoped orders from GET /api/orders and sorts newest first', async () => {
    const { user: agent } = await createAgent();
    const { user: buyer } = await createBuyer();
    const product = await createProduct({ owner: agent._id, name: 'Order Product' });
    const olderOrder = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 1000,
      status: 'paid',
      transportStatus: 'pending'
    });
    const newerOrder = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 2 }],
      totalAmount: 2000,
      status: 'paid',
      transportStatus: 'pending'
    });
    await mongoose.connection.collection('orders').updateOne(
      { _id: olderOrder._id },
      { $set: { createdAt: new Date('2026-01-01T00:00:00.000Z') } }
    );
    await mongoose.connection.collection('orders').updateOne(
      { _id: newerOrder._id },
      { $set: { createdAt: new Date('2026-02-01T00:00:00.000Z') } }
    );

    const req = createAuthenticatedRequest('http://localhost:3000/api/orders?readyForTransport=true&page=1&limit=10', agent._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agent.email
    });
    const res = await import('@/app/api/orders/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(2);
    expect(data.data[0]._id).toBe(newerOrder._id.toString());
  });

  it('persists refund reason for product transactions and exposes it in admin transaction list', async () => {
    const { user: admin } = await createAdmin();
    const { user: agent } = await createAgent();
    const { user: buyer } = await createBuyer();
    const product = await createProduct({ owner: agent._id });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 1000,
      status: 'paid'
    });
    const transaction = await createTransaction({ order: order._id, buyer: buyer._id, amount: 1000, status: 'approved' });

    const refundReq = createAuthenticatedRequest(`http://localhost:3000/api/admin/transactions/${transaction._id}/refund`, admin._id.toString(), {
      method: 'POST',
      role: 'admin',
      email: admin.email,
      body: { reason: 'Duplicate payment' }
    });
    const refundRes = await import('@/app/api/admin/transactions/[id]/refund/route').then((m) =>
      m.POST(refundReq, { params: { id: transaction._id.toString() } })
    );
    expect((refundRes as Response).status).toBe(200);

    const storedTransaction: any = await Transaction.findById(transaction._id);
    expect(storedTransaction.refundReason).toBe('Duplicate payment');

    const listReq = createAuthenticatedRequest('http://localhost:3000/api/admin/transactions?status=refunded', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const listRes = await import('@/app/api/admin/transactions/route').then((m) => m.GET(listReq));
    const listData = await getResponseJson(listRes as unknown as Response);

    expect((listRes as Response).status).toBe(200);
    expect(listData.data.transactions[0].refundReason).toBe('Duplicate payment');
  });

  it('lists unassigned fleet bookings and creates a trip from fleetId only', async () => {
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const truck = await createTruck({ transporter: transporter._id, capacity: '30 tonnes', wholeTruckOnly: false } as any);
    const product = await createProduct({ owner: agent._id, unit: 'tonne' });
    const orderA = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 10 }],
      totalAmount: 1000,
      status: 'paid'
    });
    const orderB = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 20 }],
      totalAmount: 2000,
      status: 'paid'
    });

    const bookingA = await FleetBooking.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      amount: 10000,
      loadWeightKg: 10000,
      shipmentItems: [{
        orderId: orderA._id,
        productId: product._id,
        productName: product.name,
        quantity: 10,
        unit: 'tonne',
        loadWeightKg: 10000
      }],
      wholeTruckOnly: false,
      status: 'confirmed'
    });
    await FleetBooking.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      amount: 20000,
      loadWeightKg: 20000,
      shipmentItems: [{
        orderId: orderB._id,
        productId: product._id,
        productName: product.name,
        quantity: 20,
        unit: 'tonne',
        loadWeightKg: 20000
      }],
      wholeTruckOnly: false,
      status: 'confirmed'
    });
    await FleetBooking.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      amount: 5000,
      loadWeightKg: 5000,
      shipmentItems: [],
      wholeTruckOnly: false,
      status: 'confirmed',
      fleetTripId: new mongoose.Types.ObjectId()
    });

    const bookingsReq = createAuthenticatedRequest(`http://localhost:3000/api/transporters/fleet/${truck._id}/bookings?status=confirmed&unassigned=true`, transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const bookingsRes = await import('@/app/api/transporters/fleet/[id]/bookings/route').then((m) =>
      m.GET(bookingsReq, { params: { id: truck._id.toString() } })
    );
    const bookingsData = await getResponseJson(bookingsRes as unknown as Response);

    expect((bookingsRes as Response).status).toBe(200);
    expect(bookingsData.data.length).toBe(2);
    expect(bookingsData.data.every((booking: any) => booking.fleetTripId === null)).toBe(true);

    const createTripReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/fleet-trips', transporter._id.toString(), {
      method: 'POST',
      role: 'transporter',
      email: transporter.email,
      body: { fleetId: truck._id.toString() }
    });
    const createTripRes = await import('@/app/api/transporters/fleet-trips/route').then((m) => m.POST(createTripReq));
    const createTripData = await getResponseJson(createTripRes as unknown as Response);

    expect((createTripRes as Response).status).toBe(201);
    expect(createTripData.data.orderCount).toBe(2);

    const trip = await FleetTrip.findOne({ fleet: truck._id });
    expect(trip).toBeTruthy();
    expect(trip!.bookingIds.length).toBe(2);

    const refreshedBookingA: any = await FleetBooking.findById(bookingA._id);
    expect(refreshedBookingA.fleetTripId?.toString()).toBe(trip!._id.toString());
  });

  it('creates a fleet in tonnes and exposes truck detail via /api/trucks/{id}', async () => {
    const { user: transporter } = await createTransporter();

    const createReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/fleet', transporter._id.toString(), {
      method: 'POST',
      role: 'transporter',
      email: transporter.email,
      body: {
        plateNumber: 'TST-100',
        fleetName: 'Tonnes Fleet',
        capacityTonnes: 30,
        pricingModel: 'per_tonne'
      }
    });
    const createRes = await import('@/app/api/transporters/fleet/route').then((m) => m.POST(createReq));
    const createData = await getResponseJson(createRes as unknown as Response);

    expect((createRes as Response).status).toBe(201);
    expect(createData.data.capacityKg).toBe(30000);

    const detailReq = createAuthenticatedRequest(`http://localhost:3000/api/trucks/${createData.data._id}`, transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const detailRes = await import('@/app/api/trucks/[id]/route').then((m) =>
      m.GET(detailReq, { params: { id: createData.data._id } } as any)
    );
    const detailData = await getResponseJson(detailRes as unknown as Response);

    expect((detailRes as Response).status).toBe(200);
    expect(detailData.data.capacityTonnes).toBe(30);
  });

  it('lists and approves transporters through admin approval routes', async () => {
    const { user: admin } = await createAdmin();
    const { user: transporter } = await createTransporter({
      transporterApprovalStatus: 'pending',
      businessName: 'Pending Transport Ltd'
    });

    const listReq = createAuthenticatedRequest('http://localhost:3000/api/admin/approvals/transporters?status=pending', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const listRes = await import('@/app/api/admin/approvals/transporters/route').then((m) => m.GET(listReq));
    const listData = await getResponseJson(listRes as unknown as Response);

    expect((listRes as Response).status).toBe(200);
    expect(listData.data.length).toBe(1);
    expect(listData.data[0].transporterApprovalStatus).toBe('pending');

    const patchReq = createAuthenticatedRequest(`http://localhost:3000/api/admin/approvals/transporters/${transporter._id}`, admin._id.toString(), {
      method: 'PATCH',
      role: 'admin',
      email: admin.email,
      body: { status: 'approved', reason: 'KYC complete' }
    });
    const patchRes = await import('@/app/api/admin/approvals/transporters/[id]/route').then((m) =>
      m.PATCH(patchReq, { params: { id: transporter._id.toString() } })
    );
    const patchData = await getResponseJson(patchRes as unknown as Response);

    expect((patchRes as Response).status).toBe(200);
    expect(patchData.data.transporterApprovalStatus).toBe('approved');

    const usersReq = createAuthenticatedRequest('http://localhost:3000/api/admin/users?profession=transporter', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const usersRes = await import('@/app/api/admin/users/route').then((m) => m.GET(usersReq));
    const usersData = await getResponseJson(usersRes as unknown as Response);

    expect((usersRes as Response).status).toBe(200);
    expect(usersData.data[0].transporterApprovalStatus).toBe('approved');
  });

  it('blocks unapproved transporter routes and switch-role activation until approved', async () => {
    const { user: transporter } = await createTransporter({
      transporterApprovalStatus: 'pending'
    });

    const fleetReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/fleet', transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const fleetRes = await import('@/app/api/transporters/fleet/route').then((m) => m.GET(fleetReq));
    expect((fleetRes as Response).status).toBe(403);

    const { user: multiRoleUser } = await createUser({
      roles: ['buyer', 'transporter'],
      activeRole: 'buyer',
      transporterApprovalStatus: 'pending'
    });

    const switchReq = createAuthenticatedRequest('http://localhost:3000/api/profile/switch-role', multiRoleUser._id.toString(), {
      method: 'PATCH',
      role: 'buyer',
      email: multiRoleUser.email,
      body: { activeRole: 'transporter' }
    });
    const switchRes = await import('@/app/api/profile/switch-role/route').then((m) => m.PATCH(switchReq));
    const switchData = await getResponseJson(switchRes as unknown as Response);

    expect((switchRes as Response).status).toBe(403);
    expect(String(switchData.error || '')).toMatch(/awaiting admin approval/i);
  });

  it('adds transporter role in pending state without auto-activating it', async () => {
    const { user: buyer } = await createBuyer();

    const addReq = createAuthenticatedRequest('http://localhost:3000/api/auth/add-account', buyer._id.toString(), {
      method: 'POST',
      role: 'buyer',
      email: buyer.email,
      body: {
        role: 'transporter',
        name: 'Buyer With Transporter Role',
        phone: '+2348000000000',
        address: '123 Test Street',
        country: 'Nigeria',
        state: 'Abia',
        lga: 'Umuahia South'
      }
    });
    const addRes = await import('@/app/api/auth/add-account/route').then((m) => m.POST(addReq as any));
    const addData = await getResponseJson(addRes as unknown as Response);

    expect((addRes as Response).status).toBe(200);
    expect(addData.user.activeRole).toBe('buyer');
    expect(addData.user.transporterApprovalStatus).toBe('pending');

    const refreshedUser: any = await User.findById(buyer._id);
    expect(refreshedUser.roles).toContain('transporter');
    expect(refreshedUser.activeRole).toBe('buyer');
    expect(refreshedUser.transporterApprovalStatus).toBe('pending');
  });

  it('requires active buyer role on buyer-only review, shipping, and wishlist routes', async () => {
    const { user: mixedRoleUser } = await createUser({
      roles: ['buyer', 'agent'],
      activeRole: 'agent',
      agentApprovalStatus: 'approved'
    });
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id });
    await createReview({ agent: agent._id, buyer: mixedRoleUser._id });
    await createShippingRequest({ buyer: mixedRoleUser._id, product: product._id });
    await createWishlistItem({ buyer: mixedRoleUser._id, product: product._id });

    const reviewReq = createAuthenticatedRequest('http://localhost:3000/api/reviews', mixedRoleUser._id.toString(), {
      method: 'POST',
      role: 'agent',
      email: mixedRoleUser.email,
      body: { agentId: agent._id.toString(), rating: 4, comment: 'Solid' }
    });
    const reviewRes = await import('@/app/api/reviews/route').then((m) => m.POST(reviewReq));

    const shippingReq = createAuthenticatedRequest('http://localhost:3000/api/shipping', mixedRoleUser._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: mixedRoleUser.email
    });
    const shippingRes = await import('@/app/api/shipping/route').then((m) => m.GET(shippingReq));

    const wishlistReq = createAuthenticatedRequest('http://localhost:3000/api/wishlist', mixedRoleUser._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: mixedRoleUser.email
    });
    const wishlistRes = await import('@/app/api/wishlist/route').then((m) => m.GET(wishlistReq));

    expect((reviewRes as Response).status).toBe(403);
    expect((shippingRes as Response).status).toBe(403);
    expect((wishlistRes as Response).status).toBe(403);
  });
});
