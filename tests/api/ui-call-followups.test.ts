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
import FleetPayment from '@/models/fleetPayment';
import FleetTrip from '@/models/fleetTrip';
import FleetTripTrackingEvent from '@/models/fleetTripTrackingEvent';
import SellerFollow from '@/models/sellerFollow';
import SupportTicket from '@/models/supportTicket';
import Conversation from '@/models/conversation';
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
    expect(data.data[0].fleet.iotId).toBe('IOT-100');
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
    const confirmRes = await import('@/app/api/orders/[orderId]/confirm-receipt/route').then((m) =>
      m.POST(confirmReq, { params: { orderId: order._id.toString() } })
    );
    const confirmData = await getResponseJson(confirmRes as unknown as Response);
    expect((confirmRes as Response).status).toBe(200);
    expect(confirmData.data.transportStatus).toBe('delivered');

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
    const receiptRes = await import('@/app/api/orders/[orderId]/receipt/route').then((m) =>
      m.GET(receiptReq, { params: { orderId: order._id.toString() } })
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
    const issueRes = await import('@/app/api/orders/[orderId]/issues/route').then((m) =>
      m.POST(issueReq, { params: { orderId: order._id.toString() } })
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
});
