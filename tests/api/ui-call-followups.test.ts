import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { setupTest, teardownTest } from '../setup/db';
import { createAuthenticatedRequest, getResponseJson } from '../setup/test-server';
import {
  createAdmin,
  createAgent,
  createBuyer,
  createDriver,
  createFarmer,
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
import FleetPayment from '@/models/fleetPayment';
import FleetTrip from '@/models/fleetTrip';
import FleetTripTrackingEvent from '@/models/fleetTripTrackingEvent';
import SellerFollow from '@/models/sellerFollow';
import SupportTicket from '@/models/supportTicket';
import Conversation from '@/models/conversation';
import User from '@/models/user';
import Notification from '@/models/notification';

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
    const { user: approvedTransporter } = await createTransporter({
      transporterApprovalStatus: 'approved',
      businessName: 'Approved Transport Ltd'
    });

    const defaultListReq = createAuthenticatedRequest('http://localhost:3000/api/admin/approvals/transporters', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const defaultListRes = await import('@/app/api/admin/approvals/transporters/route').then((m) => m.GET(defaultListReq));
    const defaultListData = await getResponseJson(defaultListRes as unknown as Response);

    expect((defaultListRes as Response).status).toBe(200);
    expect(defaultListData.data.map((entry: any) => entry._id)).toEqual(
      expect.arrayContaining([transporter._id.toString(), approvedTransporter._id.toString()])
    );

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

  it('lists pending agents with pagination and includes legacy null approval status as pending', async () => {
    const { user: admin } = await createAdmin();
    const { user: pendingAgent } = await createUser({
      roles: ['agent'],
      activeRole: 'agent',
      agentApprovalStatus: 'pending',
      businessName: 'Pending Agent Ltd'
    });
    const { user: legacyAgent } = await createUser({
      roles: ['agent'],
      activeRole: 'agent',
      agentApprovalStatus: null,
      businessName: 'Legacy Agent Ltd'
    });

    const listReq = createAuthenticatedRequest('http://localhost:3000/api/admin/approvals/agents?status=pending&page=1&limit=10', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const listRes = await import('@/app/api/admin/approvals/agents/route').then((m) => m.GET(listReq));
    const listData = await getResponseJson(listRes as unknown as Response);

    expect((listRes as Response).status).toBe(200);
    expect(Array.isArray(listData.data)).toBe(true);
    expect(listData.pagination.page).toBe(1);
    expect(listData.pagination.limit).toBe(10);
    expect(listData.data.map((entry: any) => entry._id)).toEqual(
      expect.arrayContaining([pendingAgent._id.toString(), legacyAgent._id.toString()])
    );
  });

  it('reactivates suspended approved transporter without clearing approval status', async () => {
    const { user: admin } = await createAdmin();
    const { user: transporter } = await createTransporter({
      status: 'suspended',
      transporterApprovalStatus: 'approved'
    });

    const reactivateReq = createAuthenticatedRequest(`http://localhost:3000/api/admin/users/${transporter._id}/reactivate`, admin._id.toString(), {
      method: 'POST',
      role: 'admin',
      email: admin.email
    });
    const reactivateRes = await import('@/app/api/admin/users/[id]/reactivate/route').then((m) =>
      m.POST(reactivateReq, { params: { id: transporter._id.toString() } })
    );
    const reactivateData = await getResponseJson(reactivateRes as unknown as Response);

    expect((reactivateRes as Response).status).toBe(200);
    expect(reactivateData.data.status).toBe('active');
    expect(reactivateData.data.transporterApprovalStatus).toBe('approved');
  });

  it('returns rich admin user detail with buyer, agent, and transporter history', async () => {
    const { user: admin } = await createAdmin();
    const { user: multiRoleUser } = await createUser({
      roles: ['buyer', 'agent', 'transporter'],
      activeRole: 'buyer',
      agentApprovalStatus: 'approved',
      transporterApprovalStatus: 'approved',
      businessName: 'Multi Role Ltd',
      phone: '+2348001112222'
    });
    const { user: buyerCustomer } = await createBuyer();
    const product = await createProduct({ owner: multiRoleUser._id, name: 'Admin Detail Product' });
    const buyerOrder = await createOrder({
      buyer: multiRoleUser._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 1200,
      status: 'paid',
      transportStatus: 'delivered'
    });
    await createTransaction({
      order: buyerOrder._id,
      buyer: multiRoleUser._id,
      amount: 1200,
      status: 'approved',
      paymentMethod: 'card'
    });

    await createOrder({
      buyer: buyerCustomer._id,
      products: [{ product: product._id, quantity: 2, lineSubtotal: 2400 } as any],
      totalAmount: 2400,
      status: 'paid',
      transportStatus: 'pending',
      transporter: multiRoleUser._id
    });

    const trip = await FleetTrip.create({
      fleet: new mongoose.Types.ObjectId(),
      transporter: multiRoleUser._id,
      buyerIds: [buyerCustomer._id],
      orderIds: [],
      bookingIds: [],
      paymentIds: [],
      status: 'on_transit',
      trackingCode: 'TRIP-DETAIL',
      loadWeightKg: 500,
      wholeTruckOnly: false
    });

    await FleetPayment.create({
      fleet: new mongoose.Types.ObjectId(),
      transporter: multiRoleUser._id,
      buyer: buyerCustomer._id,
      amount: 5000,
      loadWeightKg: 500,
      shipmentItems: [{
        orderId: buyerOrder._id,
        productId: product._id,
        productName: product.name,
        quantity: 1,
        unit: 'kg',
        loadWeightKg: 1
      }],
      paymentMethod: 'bank_transfer',
      status: 'approved',
      fleetTripId: trip._id
    });

    const req = createAuthenticatedRequest(`http://localhost:3000/api/admin/users/${multiRoleUser._id}`, admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const res = await import('@/app/api/admin/users/[id]/route').then((m) =>
      m.GET(req, { params: { id: multiRoleUser._id.toString() } })
    );
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.data.roles).toEqual(expect.arrayContaining(['buyer', 'agent', 'transporter']));
    expect(data.data.history.buyer.totalSpentApproved).toBe(1200);
    expect(data.data.history.agent.productsCount).toBeGreaterThanOrEqual(1);
    expect(data.data.history.transporter.approvedTransportRevenue).toBe(5000);

    const buyerOrdersReq = createAuthenticatedRequest(`http://localhost:3000/api/admin/users/${multiRoleUser._id}/history?role=buyer&resource=orders&page=1&limit=10`, admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const buyerOrdersRes = await import('@/app/api/admin/users/[id]/history/route').then((m) =>
      m.GET(buyerOrdersReq, { params: { id: multiRoleUser._id.toString() } })
    );
    const buyerOrdersData = await getResponseJson(buyerOrdersRes as unknown as Response);
    expect((buyerOrdersRes as Response).status).toBe(200);
    expect(buyerOrdersData.data.length).toBeGreaterThanOrEqual(1);

    const agentSalesReq = createAuthenticatedRequest(`http://localhost:3000/api/admin/users/${multiRoleUser._id}/history?role=agent&resource=sales&page=1&limit=10`, admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const agentSalesRes = await import('@/app/api/admin/users/[id]/history/route').then((m) =>
      m.GET(agentSalesReq, { params: { id: multiRoleUser._id.toString() } })
    );
    const agentSalesData = await getResponseJson(agentSalesRes as unknown as Response);
    expect((agentSalesRes as Response).status).toBe(200);
    expect(Array.isArray(agentSalesData.data)).toBe(true);

    const transporterPaymentsReq = createAuthenticatedRequest(`http://localhost:3000/api/admin/users/${multiRoleUser._id}/history?role=transporter&resource=payments&page=1&limit=10`, admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const transporterPaymentsRes = await import('@/app/api/admin/users/[id]/history/route').then((m) =>
      m.GET(transporterPaymentsReq, { params: { id: multiRoleUser._id.toString() } })
    );
    const transporterPaymentsData = await getResponseJson(transporterPaymentsRes as unknown as Response);
    expect((transporterPaymentsRes as Response).status).toBe(200);
    expect(transporterPaymentsData.data.length).toBeGreaterThanOrEqual(1);
    expect(transporterPaymentsData.pagination.page).toBe(1);
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

  it('returns admin fleet payments list and detail without intermittent populate failures', async () => {
    const { user: admin } = await createAdmin();
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer();
    const truck = await createTruck({ transporter: transporter._id, capacity: '30 tonnes' } as any);

    const booking = await FleetBooking.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      amount: 20000,
      loadWeightKg: 5000,
      shipmentItems: [],
      wholeTruckOnly: false,
      status: 'confirmed'
    });

    const payment = await FleetPayment.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      booking: booking._id,
      amount: 20000,
      loadWeightKg: 5000,
      shipmentItems: [],
      paymentMethod: 'bank_transfer',
      status: 'pending'
    });

    const listReq = createAuthenticatedRequest('http://localhost:3000/api/admin/fleet-payments?page=1&limit=10', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const listRes = await import('@/app/api/admin/fleet-payments/route').then((m) => m.GET(listReq));
    const listData = await getResponseJson(listRes as unknown as Response);

    expect((listRes as Response).status).toBe(200);
    expect(listData.success).toBe(true);
    expect(listData.data.fleetPayments.length).toBe(1);
    expect(listData.data.fleetPayments[0]._id).toBe(payment._id.toString());

    const detailReq = createAuthenticatedRequest(`http://localhost:3000/api/admin/fleet-payments/${payment._id}`, admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const detailRes = await import('@/app/api/admin/fleet-payments/[id]/route').then((m) =>
      m.GET(detailReq, { params: { id: payment._id.toString() } })
    );
    const detailData = await getResponseJson(detailRes as unknown as Response);

    expect((detailRes as Response).status).toBe(200);
    expect(detailData.success).toBe(true);
    expect(detailData.data._id).toBe(payment._id.toString());
  });

  it('enriches admin fleet payment shipment items with unit weight metadata', async () => {
    const { user: admin } = await createAdmin();
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const truck = await createTruck({ transporter: transporter._id } as any);
    const product = await createProduct({ owner: agent._id, unit: '100kg_bag', unitWeightKg: 100, name: 'Claister' });

    await FleetPayment.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      amount: 50000,
      loadWeightKg: 500,
      shipmentItems: [{
        orderId: new mongoose.Types.ObjectId(),
        productId: product._id,
        productName: product.name,
        quantity: 5,
        unit: '100kg_bag',
        loadWeightKg: 500
      }],
      paymentMethod: 'bank_transfer',
      status: 'pending'
    });

    const req = createAuthenticatedRequest('http://localhost:3000/api/admin/fleet-payments', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const res = await import('@/app/api/admin/fleet-payments/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.data.fleetPayments[0].shipmentItems[0].unitWeightKg).toBe(100);
    expect(data.data.fleetPayments[0].shipmentItems[0].isBagUnit).toBe(true);
    expect(data.data.fleetPayments[0].shipmentItems[0].loadWeightTonnes).toBe(0.5);
  });

  it('enriches buyer orders with seller, transporter, fleet, payment method, and tracking summary', async () => {
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const { user: transporter } = await createTransporter({ businessName: 'Road Haul Ltd', state: 'Kaduna', phone: '+2348000000000' });
    const product = await createProduct({ owner: agent._id, name: 'Tomatoes' });
    const truck = await createTruck({
      transporter: transporter._id,
      fleetName: 'Kaduna Route Truck',
      plateNumber: 'KRD-123',
      model: 'Mack',
      images: ['https://example.com/truck.png'],
      iot: 'IOT-100'
    } as any);
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 3 }],
      totalAmount: 9000,
      status: 'paid',
      transportStatus: 'pending'
    });
    await createTransaction({ order: order._id, buyer: buyer._id, amount: 9000, status: 'approved', paymentMethod: 'card' });
    const trip = await FleetTrip.create({
      fleet: truck._id,
      transporter: transporter._id,
      orderIds: [order._id],
      buyerIds: [buyer._id],
      bookingIds: [],
      paymentIds: [],
      status: 'on_transit',
      origin: 'Kano',
      destination: 'Kaduna',
      currentLocation: 'Kaduna',
      trackingCode: 'TRIP-100',
      loadWeightKg: 300,
      wholeTruckOnly: false
    });
    await mongoose.connection.collection('orders').updateOne(
      { _id: order._id },
      { $set: { fleetTripId: trip._id } }
    );
    await FleetTripTrackingEvent.create({
      fleetTrip: trip._id,
      status: 'loaded',
      location: 'Kano',
      note: 'Picked'
    });
    await FleetTripTrackingEvent.create({
      fleetTrip: trip._id,
      status: 'on_transit',
      location: 'Kaduna',
      note: 'Moving'
    });

    const req = createAuthenticatedRequest('http://localhost:3000/api/orders', buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email
    });
    const res = await import('@/app/api/orders/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.data[0].products[0].product.owner._id).toBe(agent._id.toString());
    expect(data.data[0].paymentMethod).toBe('card');
    expect(data.data[0].transporter.company).toBe('Road Haul Ltd');
    expect(data.data[0].fleet.plateNumber).toBe('KRD-123');
    expect(data.data[0].fleet.fleetName).toBeTruthy();
    expect(data.data[0].fleet.iotId).toBe('IOT-100');
    expect(data.data[0].fromLocation).toBe('Kano');
    expect(data.data[0].toLocation).toBe('Kaduna');
    expect(data.data[0].pickedAt).toBeTruthy();
    expect(data.data[0].onTransitAt).toBeTruthy();
    expect(data.data[0].statusHistory.length).toBe(2);
  });

  it('enriches buyer tracking response with current location object and stage timestamps', async () => {
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const { user: transporter } = await createTransporter();
    const product = await createProduct({ owner: agent._id });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 1000,
      status: 'paid'
    });
    const trip = await FleetTrip.create({
      fleet: new mongoose.Types.ObjectId(),
      transporter: transporter._id,
      orderIds: [order._id],
      buyerIds: [buyer._id],
      bookingIds: [],
      paymentIds: [],
      status: 'delivered',
      currentLocation: 'Lagos',
      trackingCode: 'TRIP-200',
      loadWeightKg: 100,
      wholeTruckOnly: false
    });
    await mongoose.connection.collection('orders').updateOne(
      { _id: order._id },
      { $set: { fleetTripId: trip._id } }
    );
    await FleetTripTrackingEvent.create({ fleetTrip: trip._id, status: 'loaded', location: 'Kano' });
    await FleetTripTrackingEvent.create({ fleetTrip: trip._id, status: 'on_transit', location: 'Kaduna' });
    await FleetTripTrackingEvent.create({ fleetTrip: trip._id, status: 'delivered', location: 'Lagos' });

    const req = createAuthenticatedRequest(`http://localhost:3000/api/transporters/orders/${order._id}/tracking`, buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email
    });
    const res = await import('@/app/api/transporters/orders/[orderId]/tracking/route').then((m) =>
      m.GET(req, { params: { orderId: order._id.toString() } })
    );
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.data.currentLocation.lat).toBeNull();
    expect(data.data.currentLocation.lng).toBeNull();
    expect(data.data.currentLocation.label).toBe('Lagos');
    expect(data.data.locationLabel).toBe('Lagos');
    expect(data.data.lastUpdatedAt).toBeTruthy();
    expect(data.data.pickedAt).toBeTruthy();
    expect(data.data.onTransitAt).toBeTruthy();
    expect(data.data.deliveredAt).toBeTruthy();
  });

  it('supports confirm receipt, transporter follow, receipt, issues, support config, and order-linked chats', async () => {
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent({ businessName: 'Seller Corp' });
    const { user: transporter } = await createTransporter();
    const product = await createProduct({ owner: agent._id, name: 'Rice', images: ['https://example.com/rice.png'] });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 2 }],
      totalAmount: 4000,
      status: 'paid',
      transportStatus: 'on_transit',
      transporter: transporter._id
    });
    await createTransaction({ order: order._id, buyer: buyer._id, amount: 4000, status: 'approved', paymentMethod: 'bank_transfer' });

    const confirmReq = createAuthenticatedRequest(`http://localhost:3000/api/orders/${order._id}/confirm-receipt`, buyer._id.toString(), {
      method: 'POST',
      role: 'buyer',
      email: buyer.email
    });
    const confirmRes = await import('@/app/api/orders/[id]/confirm-receipt/route').then((m) =>
      m.POST(confirmReq, { params: { id: order._id.toString() } })
    );
    const confirmData = await getResponseJson(confirmRes as unknown as Response);
    expect((confirmRes as Response).status).toBe(200);
    expect(confirmData.data.transportStatus).toBe('delivered');
    expect(confirmData.data.receiptConfirmed).toBe(true);
    expect(confirmData.data.receiptConfirmedAt).toBeTruthy();

    const followReq = createAuthenticatedRequest(`http://localhost:3000/api/transporters/${transporter._id}/follow`, buyer._id.toString(), {
      method: 'POST',
      role: 'buyer',
      email: buyer.email
    });
    const followRes = await import('@/app/api/transporters/[id]/follow/route').then((m) =>
      m.POST(followReq, { params: { id: transporter._id.toString() } })
    );
    expect((followRes as Response).status).toBe(201);
    expect(await SellerFollow.countDocuments({ buyer: buyer._id, seller: transporter._id })).toBe(1);

    const receiptReq = createAuthenticatedRequest(`http://localhost:3000/api/orders/${order._id}/receipt`, buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email
    });
    const receiptRes = await import('@/app/api/orders/[id]/receipt/route').then((m) =>
      m.GET(receiptReq, { params: { id: order._id.toString() } })
    );
    const receiptData = await getResponseJson(receiptRes as unknown as Response);
    expect((receiptRes as Response).status).toBe(200);
    expect(receiptData.data.paymentMethod).toBe('bank_transfer');
    expect(receiptData.data.products[0].product.owner._id).toBe(agent._id.toString());

    const issueReq = createAuthenticatedRequest(`http://localhost:3000/api/orders/${order._id}/issues`, buyer._id.toString(), {
      method: 'POST',
      role: 'buyer',
      email: buyer.email,
      body: {
        category: 'delivery_delay',
        description: 'Truck arrived late',
        attachments: ['https://example.com/evidence.png']
      }
    });
    const issueRes = await import('@/app/api/orders/[id]/issues/route').then((m) =>
      m.POST(issueReq, { params: { id: order._id.toString() } })
    );
    const issueData = await getResponseJson(issueRes as unknown as Response);
    expect((issueRes as Response).status).toBe(201);
    expect(issueData.data.category).toBe('delivery_delay');
    expect((await SupportTicket.findById(issueData.data._id))?.attachments?.length).toBe(1);

    const supportRes = await import('@/app/api/config/support/route').then((m) => m.GET());
    const supportData = await getResponseJson(supportRes as unknown as Response);
    expect((supportRes as Response).status).toBe(200);
    expect(supportData.data.hotline).toBeTruthy();

    const chatReq = createAuthenticatedRequest('http://localhost:3000/api/chats', buyer._id.toString(), {
      method: 'POST',
      role: 'buyer',
      email: buyer.email,
      body: {
        orderId: order._id.toString(),
        sellerId: agent._id.toString(),
        initialMessage: 'Hello seller'
      }
    });
    const chatRes = await import('@/app/api/chats/route').then((m) => m.POST(chatReq));
    const chatData = await getResponseJson(chatRes as unknown as Response);
    expect((chatRes as Response).status).toBe(201);
    expect(chatData.data.threadId).toBeTruthy();
    expect(await Conversation.countDocuments({ order: order._id })).toBe(1);
  });

  it('maps planned filter to legacy pending trips, accepts picked status alias, and enriches trip tracking detail', async () => {
    const { user: admin } = await createAdmin();
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id, name: 'Cassava', images: ['https://example.com/cassava.png'] });
    const truck = await createTruck({
      transporter: transporter._id,
      fleetName: 'Northern Route',
      plateNumber: 'ABC-123',
      model: 'Volvo',
      iot: 'TRK-009',
      images: ['https://example.com/truck.png'],
      estimatedDeliveryValue: 2,
      estimatedDeliveryUnit: 'days',
      route: { fromState: 'Kano', toState: 'Lagos' }
    } as any);
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 1000,
      status: 'paid'
    });
    const booking = await FleetBooking.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      amount: 5000,
      loadWeightKg: 100,
      shipmentItems: [{
        orderId: order._id,
        productId: product._id,
        productName: product.name,
        quantity: 1,
        unit: 'kg',
        loadWeightKg: 100
      }],
      wholeTruckOnly: false,
      status: 'confirmed'
    });
    const trip = await FleetTrip.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyerIds: [buyer._id],
      orderIds: [order._id],
      bookingIds: [booking._id],
      paymentIds: [],
      status: 'planned',
      origin: 'Kano',
      destination: 'Lagos',
      currentLocation: 'Kano',
      loadWeightKg: 100,
      wholeTruckOnly: false
    } as any);
    await mongoose.connection.collection('fleettrips').updateOne(
      { _id: trip._id },
      { $set: { status: 'pending' } }
    );
    await FleetTripTrackingEvent.create({ fleetTrip: trip._id, status: 'planned', location: 'Kano' });

    const listReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/fleet-trips?status=planned', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const listRes = await import('@/app/api/transporters/fleet-trips/route').then((m) => m.GET(listReq));
    const listData = await getResponseJson(listRes as unknown as Response);
    expect((listRes as Response).status).toBe(200);
    expect(listData.data[0].fleet.iotId).toBe('TRK-009');
    expect(listData.data[0].fleet.image).toBe('https://example.com/truck.png');
    expect(listData.data[0].buyers[0].name).toBeTruthy();

    const patchReq = createAuthenticatedRequest(`http://localhost:3000/api/transporters/fleet-trips/${trip._id}/status`, transporter._id.toString(), {
      method: 'PATCH',
      role: 'transporter',
      email: transporter.email,
      body: { status: 'picked', lat: 12.0, lng: 8.0, location: 'Kaduna' }
    });
    const patchRes = await import('@/app/api/transporters/fleet-trips/[tripId]/status/route').then((m) =>
      m.PATCH(patchReq, { params: { tripId: trip._id.toString() } })
    );
    const patchData = await getResponseJson(patchRes as unknown as Response);
    expect((patchRes as Response).status).toBe(200);
    expect(patchData.data.status).toBe('loaded');

    const detailReq = createAuthenticatedRequest(`http://localhost:3000/api/transporters/fleet-trips/${trip._id}/tracking`, buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email
    });
    const detailRes = await import('@/app/api/transporters/fleet-trips/[tripId]/tracking/route').then((m) =>
      m.GET(detailReq, { params: { tripId: trip._id.toString() } })
    );
    const detailData = await getResponseJson(detailRes as unknown as Response);
    expect((detailRes as Response).status).toBe(200);
    expect(detailData.data.origin).toBe('Kano');
    expect(detailData.data.destination).toBe('Lagos');
    expect(detailData.data.currentLocation.lat).toBe(12);
    expect(detailData.data.currentLocation.lng).toBe(8);
    expect(detailData.data.pickedAt).toBeTruthy();
    expect(detailData.data.estDeliveryDate).toBeTruthy();
    expect(detailData.data.packages[0].name).toBe('Cassava');
  });

  it('returns explicit approval/auth errors for transporter fleet bookings access', async () => {
    const { user: transporter } = await createTransporter();
    const { user: pendingTransporter } = await createTransporter({
      transporterApprovalStatus: 'pending'
    });
    const truck = await createTruck({ transporter: transporter._id } as any);

    const approvedReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/fleet/${truck._id}/bookings?status=confirmed&unassigned=true`,
      transporter._id.toString(),
      {
        method: 'GET',
        role: 'transporter',
        email: transporter.email
      }
    );
    const approvedRes = await import('@/app/api/transporters/fleet/[id]/bookings/route').then((m) =>
      m.GET(approvedReq, { params: { id: truck._id.toString() } })
    );
    expect((approvedRes as Response).status).toBe(200);

    const pendingReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/fleet/${truck._id}/bookings?status=confirmed&unassigned=true`,
      pendingTransporter._id.toString(),
      {
        method: 'GET',
        role: 'transporter',
        email: pendingTransporter.email
      }
    );
    const pendingRes = await import('@/app/api/transporters/fleet/[id]/bookings/route').then((m) =>
      m.GET(pendingReq, { params: { id: truck._id.toString() } })
    );
    const pendingData = await getResponseJson(pendingRes as unknown as Response);
    expect((pendingRes as Response).status).toBe(403);
    expect(String(pendingData.message || '')).toMatch(/awaiting admin approval/i);
  });

  it('supports transporter customer list, detail, chat, and shared reference data endpoints', async () => {
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer({ name: 'Grace Buyer', state: 'Kaduna', phone: '+2348111111111' });
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id, name: 'Sesame' });
    await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 2 }],
      totalAmount: 5000,
      status: 'paid',
      transportStatus: 'pending',
      transporter: transporter._id
    });

    const listReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/customers?search=grace&page=1&limit=10', transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const listRes = await import('@/app/api/transporters/customers/route').then((m) => m.GET(listReq));
    const listData = await getResponseJson(listRes as unknown as Response);
    expect((listRes as Response).status).toBe(200);
    expect(listData.data[0].name).toBe('Grace Buyer');
    expect(listData.pagination.total).toBe(1);

    const detailReq = createAuthenticatedRequest(`http://localhost:3000/api/transporters/customers/${buyer._id}`, transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const detailRes = await import('@/app/api/transporters/customers/[id]/route').then((m) =>
      m.GET(detailReq, { params: { id: buyer._id.toString() } })
    );
    const detailData = await getResponseJson(detailRes as unknown as Response);
    expect((detailRes as Response).status).toBe(200);
    expect(detailData.data.ordersCount).toBe(1);
    expect(detailData.data.recentOrders[0].products[0].product.owner._id).toBe(agent._id.toString());

    const chatReq = createAuthenticatedRequest(`http://localhost:3000/api/transporters/customers/${buyer._id}/chat`, transporter._id.toString(), {
      method: 'POST',
      role: 'transporter',
      email: transporter.email,
      body: { subject: 'Support', message: 'Checking in on your delivery' }
    });
    const chatRes = await import('@/app/api/transporters/customers/[id]/chat/route').then((m) =>
      m.POST(chatReq, { params: { id: buyer._id.toString() } })
    );
    const chatData = await getResponseJson(chatRes as unknown as Response);
    expect((chatRes as Response).status).toBe(201);
    expect(chatData.data.conversationId).toBeTruthy();

    const statesRes = await import('@/app/api/states/route').then((m) => m.GET());
    const statesData = await getResponseJson(statesRes as unknown as Response);
    expect((statesRes as Response).status).toBe(200);
    expect(statesData.data).toContain('Lagos');

    const fleetStatusesRes = await import('@/app/api/transporters/fleet-statuses/route').then((m) => m.GET());
    const fleetStatusesData = await getResponseJson(fleetStatusesRes as unknown as Response);
    expect((fleetStatusesRes as Response).status).toBe(200);
    expect(fleetStatusesData.data).toContain('under_maintenance');
  });

  it('supports transporter order list and location ping updates for trip-backed tracking', async () => {
    const { user: transporter } = await createTransporter({ businessName: 'Transit Hub' });
    const { user: buyer } = await createBuyer({ name: 'Tola Buyer', phone: '+2348222222222' });
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id, name: 'Millet' });
    const truck = await createTruck({
      transporter: transporter._id,
      fleetName: 'West Route',
      plateNumber: 'WR-500',
      model: 'DAF',
      iot: 'IOT-500',
      images: ['https://example.com/west-route.png'],
      route: { fromState: 'Kano', toState: 'Ibadan' }
    } as any);
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 4 }],
      totalAmount: 8000,
      status: 'paid',
      transportStatus: 'on_transit',
      transporter: transporter._id
    });
    const trip = await FleetTrip.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyerIds: [buyer._id],
      orderIds: [order._id],
      bookingIds: [],
      paymentIds: [],
      status: 'on_transit',
      origin: 'Kano',
      destination: 'Ibadan',
      currentLocation: 'Kaduna',
      loadWeightKg: 400,
      wholeTruckOnly: false
    });
    await mongoose.connection.collection('orders').updateOne(
      { _id: order._id },
      { $set: { fleetTripId: trip._id } }
    );

    const listReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/orders?status=on_transit&page=1&limit=10', transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const listRes = await import('@/app/api/transporters/orders/route').then((m) => m.GET(listReq));
    const listData = await getResponseJson(listRes as unknown as Response);
    expect((listRes as Response).status).toBe(200);
    expect(listData.data[0].buyer.name).toBe('Tola Buyer');
    expect(listData.data[0].fleet.plateNumber).toBe('WR-500');
    expect(listData.data[0].fromLocation).toBe('Kano');

    const locationReq = createAuthenticatedRequest(`http://localhost:3000/api/transporters/orders/${order._id}/locations`, transporter._id.toString(), {
      method: 'POST',
      role: 'transporter',
      email: transporter.email,
      body: { lat: 7.3775, lng: 3.947, location: 'Ibadan toll gate', note: 'GPS ping' }
    });
    const locationRes = await import('@/app/api/transporters/orders/[orderId]/locations/route').then((m) =>
      m.POST(locationReq, { params: { orderId: order._id.toString() } })
    );
    const locationData = await getResponseJson(locationRes as unknown as Response);
    expect((locationRes as Response).status).toBe(200);
    expect(locationData.data.currentLocation.label).toBe('Ibadan toll gate');

    const trackingReq = createAuthenticatedRequest(`http://localhost:3000/api/orders/${order._id}/tracking`, buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email
    });
    const trackingRes = await import('@/app/api/orders/[id]/tracking/route').then((m) =>
      m.GET(trackingReq, { params: { orderId: order._id.toString() } } as any)
    );
    const trackingData = await getResponseJson(trackingRes as unknown as Response);
    expect((trackingRes as Response).status).toBe(200);
    expect(trackingData.data.currentLocation.lat).toBe(7.3775);
    expect(trackingData.data.locationLabel).toBe('Ibadan toll gate');
  });

  it('supports transporter dashboard overview, revenue, top customers, transit, and review summary endpoints', async () => {
    const { user: transporter } = await createTransporter({ businessName: 'Haul Masters' });
    const { user: buyer } = await createBuyer({ name: 'Ada Buyer' });
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id, name: 'Beans' });
    const truck = await createTruck({ transporter: transporter._id, fleetName: 'Central Fleet' } as any);
    const driver = await createDriver({ transporter: transporter._id, assignedTruck: truck._id, name: 'Driver One' });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 12000,
      status: 'paid',
      transportStatus: 'pending',
      transporter: transporter._id
    });
    await createTransaction({
      order: order._id,
      buyer: buyer._id,
      amount: 12000,
      status: 'approved',
      paymentMethod: 'wallet'
    });
    await createReview({ agent: transporter._id, buyer: buyer._id, rating: 5 });
    await FleetTrip.create({
      fleet: truck._id,
      transporter: transporter._id,
      driver: driver._id,
      buyerIds: [buyer._id],
      orderIds: [order._id],
      bookingIds: [],
      paymentIds: [],
      status: 'on_transit',
      currentLocation: 'Lokoja',
      loadWeightKg: 100,
      wholeTruckOnly: false
    });

    const overviewReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/dashboard/overview', transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const overviewRes = await import('@/app/api/transporters/dashboard/overview/route').then((m) => m.GET(overviewReq));
    const overviewData = await getResponseJson(overviewRes as unknown as Response);
    expect((overviewRes as Response).status).toBe(200);
    expect(overviewData.data.revenue).toBe(12000);
    expect(overviewData.data.drivers).toBe(1);

    const revenueReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/dashboard/revenue', transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const revenueRes = await import('@/app/api/transporters/dashboard/revenue/route').then((m) => m.GET(revenueReq));
    const revenueData = await getResponseJson(revenueRes as unknown as Response);
    expect((revenueRes as Response).status).toBe(200);
    expect(revenueData.data.totalRevenue).toBe(12000);

    const topCustomersReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/dashboard/top-customers?limit=5', transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const topCustomersRes = await import('@/app/api/transporters/dashboard/top-customers/route').then((m) => m.GET(topCustomersReq));
    const topCustomersData = await getResponseJson(topCustomersRes as unknown as Response);
    expect((topCustomersRes as Response).status).toBe(200);
    expect(topCustomersData.data[0].name).toBe('Ada Buyer');

    const transitReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/dashboard/transit?status=in_progress&limit=10', transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const transitRes = await import('@/app/api/transporters/dashboard/transit/route').then((m) => m.GET(transitReq));
    const transitData = await getResponseJson(transitRes as unknown as Response);
    expect((transitRes as Response).status).toBe(200);
    expect(transitData.data[0].currentLocation).toBe('Lokoja');

    const mostHiredReq = createAuthenticatedRequest('http://localhost:3000/api/transporters/dashboard/most-hired-drivers?limit=5', transporter._id.toString(), {
      method: 'GET',
      role: 'transporter',
      email: transporter.email
    });
    const mostHiredRes = await import('@/app/api/transporters/dashboard/most-hired-drivers/route').then((m) => m.GET(mostHiredReq));
    const mostHiredData = await getResponseJson(mostHiredRes as unknown as Response);
    expect((mostHiredRes as Response).status).toBe(200);
    expect(mostHiredData.data[0].name).toBe('Driver One');

    const summaryReq = createAuthenticatedRequest(`http://localhost:3000/api/transporters/${transporter._id}/reviews/summary`, buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email
    });
    const summaryRes = await import('@/app/api/transporters/[id]/reviews/summary/route').then((m) =>
      m.GET(summaryReq, { params: { id: transporter._id.toString() } })
    );
    const summaryData = await getResponseJson(summaryRes as unknown as Response);
    expect((summaryRes as Response).status).toBe(200);
    expect(summaryData.data.overallRating).toBe(5);
    expect(summaryData.data.totalReviews).toBe(1);
  });

  it('supports agent me, review summary, enriched categories, transporter directory, buyer bank accounts, payment confirmation, banners, and unread notifications filter', async () => {
    const { user: agent } = await createAgent({ businessName: 'Agent House', state: 'Kaduna' });
    const { user: buyer } = await createBuyer({ name: 'Mira Buyer' });
    const { user: transporter } = await createTransporter({ businessName: 'MoveFast Logistics', state: 'Lagos' });
    const product = await createProduct({
      owner: agent._id,
      name: 'Rice',
      category: 'Grains',
      subcategory: 'Rice',
      categories: ['Grains']
    } as any);
    const truck = await createTruck({
      transporter: transporter._id,
      route: { fromState: 'Lagos', toState: 'Oyo' }
    } as any);
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 7000,
      status: 'pending',
      transporter: transporter._id
    });
    const transaction = await createTransaction({
      order: order._id,
      buyer: buyer._id,
      amount: 7000,
      status: 'pending',
      paymentMethod: 'bank_transfer',
      paymentReference: 'PAY-CONFIRM-100'
    });
    await createReview({ agent: agent._id, buyer: buyer._id, rating: 4 });
    await Notification.create({
      user: buyer._id,
      type: 'generic',
      title: 'Unread note',
      message: 'Still unread',
      isRead: false
    });
    await Notification.create({
      user: buyer._id,
      type: 'generic',
      title: 'Read note',
      message: 'Already read',
      isRead: true
    });

    const meReq = createAuthenticatedRequest('http://localhost:3000/api/agents/me', agent._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agent.email
    });
    const meRes = await import('@/app/api/agents/me/route').then((m) => m.GET(meReq));
    const meData = await getResponseJson(meRes as unknown as Response);
    expect((meRes as Response).status).toBe(200);
    expect(meData.data.businessName).toBe('Agent House');

    const reviewSummaryReq = createAuthenticatedRequest(`http://localhost:3000/api/reviews/summary?agentId=${agent._id}`, buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email
    });
    const reviewSummaryRes = await import('@/app/api/reviews/summary/route').then((m) => m.GET(reviewSummaryReq));
    const reviewSummaryData = await getResponseJson(reviewSummaryRes as unknown as Response);
    expect((reviewSummaryRes as Response).status).toBe(200);
    expect(reviewSummaryData.data.totalReviews).toBe(1);
    expect(reviewSummaryData.data.ratingDistribution.find((item: any) => item.rating === 4).count).toBe(1);

    const categoriesReq = createAuthenticatedRequest('http://localhost:3000/api/categories?withSubcategories=true', buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email
    });
    const categoriesRes = await import('@/app/api/categories/route').then((m) => m.GET(categoriesReq));
    const categoriesData = await getResponseJson(categoriesRes as unknown as Response);
    expect((categoriesRes as Response).status).toBe(200);
    expect(categoriesData.data[0].id).toBeTruthy();
    expect(categoriesData.data[0].subcategories[0].id).toBeTruthy();

    const transportersReq = createAuthenticatedRequest('http://localhost:3000/api/transporters', buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email
    });
    const transportersRes = await import('@/app/api/transporters/route').then((m) => m.GET(transportersReq));
    const transportersData = await getResponseJson(transportersRes as unknown as Response);
    expect((transportersRes as Response).status).toBe(200);
    expect(transportersData.data[0].coverageStates).toEqual(expect.arrayContaining(['Lagos', 'Oyo']));
    expect(transportersData.data[0].customersCount).toBe(1);

    const bankAccountsRes = await import('@/app/api/payment/bank-accounts/route').then((m) => m.GET());
    const bankAccountsData = await getResponseJson(bankAccountsRes as unknown as Response);
    expect((bankAccountsRes as Response).status).toBe(200);
    expect(bankAccountsData.data.length).toBeGreaterThan(0);

    const confirmReq = createAuthenticatedRequest(`http://localhost:3000/api/payments/${transaction.paymentReference}/confirm`, buyer._id.toString(), {
      method: 'POST',
      role: 'buyer',
      email: buyer.email,
      body: {
        bankUsed: 'Access Bank',
        narration: 'Manual transfer',
        screenshotUrl: 'https://example.com/proof.png'
      }
    });
    const confirmRes = await import('@/app/api/payments/[paymentRef]/confirm/route').then((m) =>
      m.POST(confirmReq, { params: { paymentRef: String(transaction.paymentReference) } })
    );
    const confirmData = await getResponseJson(confirmRes as unknown as Response);
    expect((confirmRes as Response).status).toBe(200);
    expect(confirmData.data.paymentConfirmation.bankUsed).toBe('Access Bank');

    const bannersRes = await import('@/app/api/buyers/banners/route').then((m) => m.GET());
    const bannersData = await getResponseJson(bannersRes as unknown as Response);
    expect((bannersRes as Response).status).toBe(200);
    expect(bannersData.data[0].imageUrl).toBeTruthy();

    const notificationsReq = createAuthenticatedRequest('http://localhost:3000/api/notifications?unread=true&page=1&limit=10', buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email
    });
    const notificationsRes = await import('@/app/api/notifications/route').then((m) => m.GET(notificationsReq));
    const notificationsData = await getResponseJson(notificationsRes as unknown as Response);
    expect((notificationsRes as Response).status).toBe(200);
    expect(Array.isArray(notificationsData.data)).toBe(true);
    expect(notificationsData.data.length).toBe(1);
    expect(notificationsData.data[0].title).toBe('Unread note');
  });

  it('supports agent dashboard and agent order detail/tracking endpoints', async () => {
    const { user: agent } = await createAgent({ businessName: 'North Agent' });
    const { user: buyer } = await createBuyer({ name: 'Buyer Agent Test' });
    const { user: transporter } = await createTransporter({ businessName: 'Transit Agent Test' });
    await createFarmer({ createdBy: agent._id, approvalStatus: 'approved' });
    const productA = await createProduct({
      owner: agent._id,
      name: 'Maize',
      category: 'Grains',
      quantity: 25
    } as any);
    const productB = await createProduct({
      owner: agent._id,
      name: 'Cassava',
      category: 'Tubers',
      quantity: 0,
      status: 'out_of_stock'
    } as any);
    const truck = await createTruck({
      transporter: transporter._id,
      plateNumber: 'AGT-200',
      iot: 'AGENT-IOT',
      route: { fromState: 'Kaduna', toState: 'Lagos' }
    } as any);
    const order = await createOrder({
      buyer: buyer._id,
      products: [
        { product: productA._id, quantity: 3, lineSubtotal: 9000 } as any,
        { product: productB._id, quantity: 1, lineSubtotal: 1000 } as any
      ],
      totalAmount: 10000,
      status: 'paid',
      transportStatus: 'on_transit',
      transporter: transporter._id
    });
    await createTransaction({
      order: order._id,
      buyer: buyer._id,
      amount: 10000,
      status: 'approved',
      paymentMethod: 'card'
    });
    const trip = await FleetTrip.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyerIds: [buyer._id],
      orderIds: [order._id],
      bookingIds: [],
      paymentIds: [],
      status: 'on_transit',
      origin: 'Kaduna',
      destination: 'Lagos',
      currentLocation: 'Lokoja',
      loadWeightKg: 400,
      wholeTruckOnly: false
    });
    await mongoose.connection.collection('orders').updateOne(
      { _id: order._id },
      { $set: { fleetTripId: trip._id } }
    );
    await FleetTripTrackingEvent.create({ fleetTrip: trip._id, status: 'loaded', location: 'Kaduna' });
    await FleetTripTrackingEvent.create({ fleetTrip: trip._id, status: 'on_transit', location: 'Lokoja', latitude: 8.0, longitude: 6.7 });

    const overviewReq = createAuthenticatedRequest('http://localhost:3000/api/agents/dashboard/overview', agent._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agent.email
    });
    const overviewRes = await import('@/app/api/agents/dashboard/overview/route').then((m) => m.GET(overviewReq));
    const overviewData = await getResponseJson(overviewRes as unknown as Response);
    expect((overviewRes as Response).status).toBe(200);
    expect(overviewData.data.products).toBe(2);
    expect(overviewData.data.customers).toBe(1);

    const revenueReq = createAuthenticatedRequest('http://localhost:3000/api/agents/dashboard/revenue', agent._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agent.email
    });
    const revenueRes = await import('@/app/api/agents/dashboard/revenue/route').then((m) => m.GET(revenueReq));
    const revenueData = await getResponseJson(revenueRes as unknown as Response);
    expect((revenueRes as Response).status).toBe(200);
    expect(Array.isArray(revenueData.data)).toBe(true);

    const topCustomersReq = createAuthenticatedRequest('http://localhost:3000/api/agents/dashboard/top-customers?limit=5', agent._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agent.email
    });
    const topCustomersRes = await import('@/app/api/agents/dashboard/top-customers/route').then((m) => m.GET(topCustomersReq));
    const topCustomersData = await getResponseJson(topCustomersRes as unknown as Response);
    expect((topCustomersRes as Response).status).toBe(200);
    expect(topCustomersData.data[0].name).toBe('Buyer Agent Test');

    const soldItemsRes = await import('@/app/api/agents/dashboard/most-sold-items/route').then((m) => m.GET(overviewReq));
    const soldItemsData = await getResponseJson(soldItemsRes as unknown as Response);
    expect((soldItemsRes as Response).status).toBe(200);
    expect(soldItemsData.data[0].name).toBeTruthy();

    const categoriesRes = await import('@/app/api/agents/dashboard/most-sold-categories/route').then((m) => m.GET(overviewReq));
    const categoriesData = await getResponseJson(categoriesRes as unknown as Response);
    expect((categoriesRes as Response).status).toBe(200);
    expect(categoriesData.data.length).toBeGreaterThan(0);

    const outOfStockReq = createAuthenticatedRequest('http://localhost:3000/api/agents/dashboard/out-of-stock?limit=7', agent._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agent.email
    });
    const outOfStockRes = await import('@/app/api/agents/dashboard/out-of-stock/route').then((m) => m.GET(outOfStockReq));
    const outOfStockData = await getResponseJson(outOfStockRes as unknown as Response);
    expect((outOfStockRes as Response).status).toBe(200);
    expect(outOfStockData.data[0].name).toBe('Cassava');

    const orderReq = createAuthenticatedRequest(`http://localhost:3000/api/agents/orders/${order._id}`, agent._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agent.email
    });
    const orderRes = await import('@/app/api/agents/orders/[orderId]/route').then((m) =>
      m.GET(orderReq, { params: { orderId: order._id.toString() } })
    );
    const orderData = await getResponseJson(orderRes as unknown as Response);
    expect((orderRes as Response).status).toBe(200);
    expect(orderData.data.buyer.name).toBe('Buyer Agent Test');
    expect(orderData.data.plateNumber).toBe('AGT-200');
    expect(orderData.data.iotId).toBe('AGENT-IOT');

    const trackingReq = createAuthenticatedRequest(`http://localhost:3000/api/agents/orders/${order._id}/tracking`, agent._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agent.email
    });
    const trackingRes = await import('@/app/api/agents/orders/[orderId]/tracking/route').then((m) =>
      m.GET(trackingReq, { params: { orderId: order._id.toString() } })
    );
    const trackingData = await getResponseJson(trackingRes as unknown as Response);
    expect((trackingRes as Response).status).toBe(200);
    expect(trackingData.data.fromState).toBe('Kaduna');
    expect(trackingData.data.toState).toBe('Lagos');
    expect(trackingData.data.mapMarkers.length).toBe(2);
  });

  it('supports admin dashboard aliases and admin track-order/detail endpoints', async () => {
    const { user: admin } = await createAdmin();
    const { user: agent } = await createAgent({ businessName: 'Admin Agent' });
    const { user: buyer } = await createBuyer({ name: 'Admin Buyer' });
    const { user: transporter } = await createTransporter({ businessName: 'Admin Transporter' });
    const product = await createProduct({ owner: agent._id, name: 'Soya' });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 2 }],
      totalAmount: 6000,
      status: 'paid',
      transportStatus: 'picked',
      transporter: transporter._id
    });
    await createTransaction({
      order: order._id,
      buyer: buyer._id,
      amount: 6000,
      status: 'approved',
      paymentMethod: 'wallet'
    });

    const overviewReq = createAuthenticatedRequest('http://localhost:3000/api/admin/dashboard/overview', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const overviewRes = await import('@/app/api/admin/dashboard/overview/route').then((m) => m.GET(overviewReq));
    const overviewData = await getResponseJson(overviewRes as unknown as Response);
    expect((overviewRes as Response).status).toBe(200);
    expect(overviewData.data.users.value).toBeGreaterThan(0);

    const revenueReq = createAuthenticatedRequest('http://localhost:3000/api/admin/dashboard/revenue', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const revenueRes = await import('@/app/api/admin/dashboard/revenue/route').then((m) => m.GET(revenueReq));
    const revenueData = await getResponseJson(revenueRes as unknown as Response);
    expect((revenueRes as Response).status).toBe(200);
    expect(Array.isArray(revenueData.data)).toBe(true);

    const topAgentsRes = await import('@/app/api/admin/dashboard/top-agents/route').then((m) => m.GET(overviewReq));
    const topAgentsData = await getResponseJson(topAgentsRes as unknown as Response);
    expect((topAgentsRes as Response).status).toBe(200);
    expect(Array.isArray(topAgentsData.data)).toBe(true);

    const topBuyersRes = await import('@/app/api/admin/dashboard/top-buyers/route').then((m) => m.GET(overviewReq));
    const topBuyersData = await getResponseJson(topBuyersRes as unknown as Response);
    expect((topBuyersRes as Response).status).toBe(200);
    expect(Array.isArray(topBuyersData.data)).toBe(true);

    const topTransportersRes = await import('@/app/api/admin/dashboard/top-transporters/route').then((m) => m.GET(overviewReq));
    const topTransportersData = await getResponseJson(topTransportersRes as unknown as Response);
    expect((topTransportersRes as Response).status).toBe(200);
    expect(Array.isArray(topTransportersData.data)).toBe(true);

    const trackAgentReq = createAuthenticatedRequest('http://localhost:3000/api/admin/orders/track/agent?status=paid&page=1&limit=10', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const trackAgentRes = await import('@/app/api/admin/orders/track/agent/route').then((m) => m.GET(trackAgentReq));
    const trackAgentData = await getResponseJson(trackAgentRes as unknown as Response);
    expect((trackAgentRes as Response).status).toBe(200);
    expect(trackAgentData.data[0].buyer.name).toBe('Admin Buyer');

    const trackTransporterReq = createAuthenticatedRequest('http://localhost:3000/api/admin/orders/track/transporter?status=picked&page=1&limit=10', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const trackTransporterRes = await import('@/app/api/admin/orders/track/transporter/route').then((m) => m.GET(trackTransporterReq));
    const trackTransporterData = await getResponseJson(trackTransporterRes as unknown as Response);
    expect((trackTransporterRes as Response).status).toBe(200);
    expect(trackTransporterData.data[0].transportStatus).toBe('picked');

    const buyerInfoRes = await import('@/app/api/admin/orders/[orderId]/buyer-info/route').then((m) =>
      m.GET(overviewReq, { params: { orderId: order._id.toString() } })
    );
    const buyerInfoData = await getResponseJson(buyerInfoRes as unknown as Response);
    expect((buyerInfoRes as Response).status).toBe(200);
    expect(buyerInfoData.data.name).toBe('Admin Buyer');

    const sellerInfoRes = await import('@/app/api/admin/orders/[orderId]/seller-info/route').then((m) =>
      m.GET(overviewReq, { params: { orderId: order._id.toString() } })
    );
    const sellerInfoData = await getResponseJson(sellerInfoRes as unknown as Response);
    expect((sellerInfoRes as Response).status).toBe(200);
    expect(sellerInfoData.data[0].businessName).toBe('Admin Agent');

    const transporterInfoRes = await import('@/app/api/admin/orders/[orderId]/transporter-info/route').then((m) =>
      m.GET(overviewReq, { params: { orderId: order._id.toString() } })
    );
    const transporterInfoData = await getResponseJson(transporterInfoRes as unknown as Response);
    expect((transporterInfoRes as Response).status).toBe(200);
    expect(transporterInfoData.data.businessName).toBe('Admin Transporter');

    const adminTrackingRes = await import('@/app/api/admin/orders/[orderId]/tracking/route').then((m) =>
      m.GET(overviewReq, { params: { orderId: order._id.toString() } })
    );
    expect((adminTrackingRes as Response).status).toBe(200);
  });

  it('supports notifications SSE stream with initial snapshot payload', async () => {
    const { user: buyer } = await createBuyer();
    await Notification.create({
      user: buyer._id,
      type: 'generic',
      title: 'Fresh alert',
      message: 'You have a new update',
      isRead: false
    });

    const req = createAuthenticatedRequest('http://localhost:3000/api/notifications/stream?unread=true&limit=10', buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email
    });
    const res = await import('@/app/api/notifications/stream/route').then((m) => m.GET(req));

    expect((res as Response).status).toBe(200);
    expect((res as Response).headers.get('content-type')).toContain('text/event-stream');

    const reader = (res as Response).body!.getReader();
    const firstChunk = await reader.read();
    const secondChunk = await reader.read();
    await reader.cancel();

    const decoder = new TextDecoder();
    const payload = `${decoder.decode(firstChunk.value || new Uint8Array())}${decoder.decode(secondChunk.value || new Uint8Array())}`;
    expect(payload).toContain('event: connected');
    expect(payload).toContain('event: snapshot');
    expect(payload).toContain('Fresh alert');
    expect(payload).toContain('"unreadCount":1');
  });

  it('supports generic admin approvals compatibility endpoints and exact admin dashboard list shapes', async () => {
    const { user: admin } = await createAdmin();
    const { user: agent } = await createUser({
      roles: ['agent'],
      activeRole: 'agent',
      agentApprovalStatus: 'pending',
      businessName: 'Compat Agent'
    });
    const { user: transporter } = await createTransporter({ transporterApprovalStatus: 'pending', businessName: 'Compat Transporter' });
    const farmer = await createFarmer({ createdBy: agent._id, approvalStatus: 'pending', name: 'Compat Farmer' });

    const listReq = createAuthenticatedRequest('http://localhost:3000/api/admin/approvals?type=agent&status=pending&page=1&limit=10', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const listRes = await import('@/app/api/admin/approvals/route').then((m) => m.GET(listReq));
    const listData = await getResponseJson(listRes as unknown as Response);
    expect((listRes as Response).status).toBe(200);
    expect(listData.data.some((item: any) => item._id === agent._id.toString())).toBe(true);

    const approveReq = createAuthenticatedRequest(`http://localhost:3000/api/admin/approvals/${transporter._id}/approve`, admin._id.toString(), {
      method: 'POST',
      role: 'admin',
      email: admin.email,
      body: { type: 'transporter', note: 'Approved from compat route' }
    });
    const approveRes = await import('@/app/api/admin/approvals/[id]/approve/route').then((m) =>
      m.POST(approveReq, { params: { id: transporter._id.toString() } })
    );
    const approveData = await getResponseJson(approveRes as unknown as Response);
    expect((approveRes as Response).status).toBe(200);
    expect(approveData.data.status).toBe('approved');

    const declineReq = createAuthenticatedRequest(`http://localhost:3000/api/admin/approvals/${farmer._id}/decline`, admin._id.toString(), {
      method: 'POST',
      role: 'admin',
      email: admin.email,
      body: { type: 'farmer', reason: 'Incomplete KYC' }
    });
    const declineRes = await import('@/app/api/admin/approvals/[id]/decline/route').then((m) =>
      m.POST(declineReq, { params: { id: farmer._id.toString() } })
    );
    const declineData = await getResponseJson(declineRes as unknown as Response);
    expect((declineRes as Response).status).toBe(200);
    expect(declineData.data.status).toBe('rejected');

    const topAgentReq = createAuthenticatedRequest('http://localhost:3000/api/admin/top-agents?limit=5', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const topAgentRes = await import('@/app/api/admin/top-agents/route').then((m) => m.GET(topAgentReq));
    const topAgentData = await getResponseJson(topAgentRes as unknown as Response);
    expect((topAgentRes as Response).status).toBe(200);
    if (topAgentData.data.length > 0) {
      expect(topAgentData.data[0]).toHaveProperty('id');
      expect(topAgentData.data[0]).toHaveProperty('revenue');
      expect(topAgentData.data[0]).toHaveProperty('orders');
    }
  });

  it('supports admin user state/month filters and agent customer location/month aliases', async () => {
    const { user: admin } = await createAdmin();
    const { user: agent } = await createAgent({ state: 'Kano' });
    const { user: buyer } = await createBuyer({ state: 'Kano', name: 'Kano Buyer' });
    const product = await createProduct({ owner: agent._id, name: 'Groundnut' });
    await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 2000,
      status: 'paid'
    });
    await mongoose.connection.collection('users').updateOne(
      { _id: buyer._id },
      { $set: { createdAt: new Date('2026-03-15T00:00:00.000Z') } }
    );

    const usersReq = createAuthenticatedRequest('http://localhost:3000/api/admin/users?state=Kano&year=2026&month=3&page=1&limit=10', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const usersRes = await import('@/app/api/admin/users/route').then((m) => m.GET(usersReq));
    const usersData = await getResponseJson(usersRes as unknown as Response);
    expect((usersRes as Response).status).toBe(200);
    expect(usersData.data.some((item: any) => item.email === buyer.email)).toBe(true);

    const customersReq = createAuthenticatedRequest('http://localhost:3000/api/customers?location=Kano&year=2026&month=3&page=1&limit=10', agent._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agent.email
    });
    const customersRes = await import('@/app/api/customers/route').then((m) => m.GET(customersReq));
    const customersData = await getResponseJson(customersRes as unknown as Response);
    expect((customersRes as Response).status).toBe(200);
    expect(customersData.data.customers.some((item: any) => item.email === buyer.email)).toBe(true);
  });

  it('computes non-placeholder admin overview deltas and exposes visitor proxy metrics', async () => {
    const { user: admin } = await createAdmin();
    const { user: buyerOld } = await createBuyer();
    const { user: buyerNew } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id, name: 'Delta Rice' });
    const oldOrder = await createOrder({
      buyer: buyerOld._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 1000,
      status: 'paid'
    });
    const newOrder = await createOrder({
      buyer: buyerNew._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 3000,
      status: 'paid'
    });
    await createTransaction({ order: oldOrder._id, buyer: buyerOld._id, amount: 1000, status: 'approved' });
    await createTransaction({ order: newOrder._id, buyer: buyerNew._id, amount: 3000, status: 'approved' });

    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
    await mongoose.connection.collection('users').updateMany(
      { _id: { $in: [buyerNew._id, agent._id] } },
      { $set: { createdAt: fiveDaysAgo, updatedAt: fiveDaysAgo } }
    );
    await mongoose.connection.collection('users').updateOne(
      { _id: buyerOld._id },
      { $set: { createdAt: fortyDaysAgo, updatedAt: fortyDaysAgo } }
    );
    await mongoose.connection.collection('orders').updateOne(
      { _id: newOrder._id },
      { $set: { createdAt: fiveDaysAgo } }
    );
    await mongoose.connection.collection('orders').updateOne(
      { _id: oldOrder._id },
      { $set: { createdAt: fortyDaysAgo } }
    );
    await mongoose.connection.collection('transactions').updateOne(
      { order: newOrder._id },
      { $set: { createdAt: fiveDaysAgo } }
    );
    await mongoose.connection.collection('transactions').updateOne(
      { order: oldOrder._id },
      { $set: { createdAt: fortyDaysAgo } }
    );

    const overviewReq = createAuthenticatedRequest('http://localhost:3000/api/admin/dashboard/overview', admin._id.toString(), {
      method: 'GET',
      role: 'admin',
      email: admin.email
    });
    const overviewRes = await import('@/app/api/admin/dashboard/overview/route').then((m) => m.GET(overviewReq));
    const overviewData = await getResponseJson(overviewRes as unknown as Response);
    expect((overviewRes as Response).status).toBe(200);
    expect(typeof overviewData.data.users.deltaPercent).toBe('number');
    expect(overviewData.data.users.deltaPercent).not.toBe(0);
    expect(overviewData.data.payments.deltaPercent).not.toBe(0);
    expect(overviewData.data.visitors.metricSource).toBe('user_activity_proxy');

    const visitorsRes = await import('@/app/api/admin/dashboard/visitors/route').then((m) => m.GET(overviewReq));
    const visitorsData = await getResponseJson(visitorsRes as unknown as Response);
    expect((visitorsRes as Response).status).toBe(200);
    expect(visitorsData.data.metricSource).toBe('user_activity_proxy');
    expect(visitorsData.data.totalVisitors).toBeGreaterThan(0);
  });
});
