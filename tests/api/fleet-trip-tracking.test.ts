import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTest, teardownTest } from '../setup/db';
import { createAuthenticatedRequest, getResponseJson } from '../setup/test-server';
import { createAdmin, createAgent, createBuyer, createOrder, createProduct, createTransporter, createTruck } from '../factories';
import FleetBooking from '@/models/fleetBooking';
import FleetPayment from '@/models/fleetPayment';
import FleetTrip from '@/models/fleetTrip';
import Order from '@/models/order';
import Truck from '@/models/truck';

describe('Fleet trip tracking', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('auto-creates a fleet trip for whole-truck payment approval and exposes order tracking through the trip', async () => {
    const { user: admin } = await createAdmin();
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id, unit: '100kg_bag', unitWeightKg: 100 });
    const order = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 10 }],
      totalAmount: 10000,
      status: 'paid',
      transportStatus: 'pending'
    });
    const truck = await createTruck({
      transporter: transporter._id,
      capacity: '30 tonnes',
      pricingModel: 'flat_rate_whole_truck',
      wholeTruckOnly: true
    } as any);

    const booking = await FleetBooking.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      amount: 50000,
      loadWeightKg: 1000,
      shipmentItems: [{
        orderId: order._id,
        productId: product._id,
        productName: product.name,
        quantity: 10,
        unit: '100kg_bag',
        loadWeightKg: 1000
      }],
      wholeTruckOnly: true,
      status: 'pending_payment'
    });
    const payment = await FleetPayment.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      booking: booking._id,
      amount: 50000,
      loadWeightKg: 1000,
      shipmentItems: booking.shipmentItems,
      wholeTruckOnly: true,
      paymentMethod: 'bank_transfer',
      status: 'pending'
    });
    booking.payment = payment._id;
    await booking.save();

    const approveReq = createAuthenticatedRequest(
      `http://localhost:3000/api/fleet-payments/${payment._id}/status`,
      admin._id.toString(),
      { method: 'PATCH', body: { status: 'approved' }, role: 'admin', email: admin.email }
    );
    const approveRes = await import('@/app/api/fleet-payments/[id]/status/route').then((m) =>
      m.PATCH(approveReq, { params: { id: payment._id.toString() } })
    );
    expect((approveRes as Response).status).toBe(200);

    const trip = await FleetTrip.findOne({ paymentIds: payment._id });
    expect(trip).toBeTruthy();

    const trackedOrder: any = await Order.findById(order._id);
    expect(trackedOrder.fleetTripId?.toString()).toBe(trip!._id.toString());

    const trackingReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/orders/${order._id}/tracking`,
      buyer._id.toString(),
      { method: 'GET', role: 'buyer', email: buyer.email }
    );
    const trackingRes = await import('@/app/api/transporters/orders/[orderId]/tracking/route').then((m) =>
      m.GET(trackingReq, { params: { orderId: order._id.toString() } })
    );
    const trackingData = await getResponseJson(trackingRes as unknown as Response);

    expect((trackingRes as Response).status).toBe(200);
    expect(trackingData.data.fleetTripId).toBe(trip!._id.toString());
    expect(trackingData.data.timeline.length).toBeGreaterThan(0);
    expect(trackingData.data.timeline[0].status).toBe('planned');
  });

  it('creates manual trips from confirmed shared-load bookings and updates linked orders through trip status', async () => {
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id, unit: '50kg_bag', unitWeightKg: 50 });
    const orderA = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 5 }],
      totalAmount: 5000,
      status: 'paid',
      transportStatus: 'pending'
    });
    const orderB = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 3 }],
      totalAmount: 3000,
      status: 'paid',
      transportStatus: 'pending'
    });
    const truck = await createTruck({
      transporter: transporter._id,
      capacity: '30 tonnes',
      pricingModel: 'per_tonne',
      wholeTruckOnly: false
    } as any);

    const bookingA = await FleetBooking.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      amount: 10000,
      loadWeightKg: 250,
      shipmentItems: [{
        orderId: orderA._id,
        productId: product._id,
        productName: product.name,
        quantity: 5,
        unit: '50kg_bag',
        loadWeightKg: 250
      }],
      wholeTruckOnly: false,
      status: 'confirmed'
    });
    const bookingB = await FleetBooking.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      amount: 10000,
      loadWeightKg: 150,
      shipmentItems: [{
        orderId: orderB._id,
        productId: product._id,
        productName: product.name,
        quantity: 3,
        unit: '50kg_bag',
        loadWeightKg: 150
      }],
      wholeTruckOnly: false,
      status: 'confirmed'
    });

    const createTripReq = createAuthenticatedRequest(
      'http://localhost:3000/api/transporters/fleet-trips',
      transporter._id.toString(),
      {
        method: 'POST',
        body: {
          fleetId: truck._id.toString(),
          bookingIds: [bookingA._id.toString(), bookingB._id.toString()],
          origin: 'Abia',
          destination: 'Anambra'
        },
        role: 'transporter',
        email: transporter.email
      }
    );
    const createTripRes = await import('@/app/api/transporters/fleet-trips/route').then((m) => m.POST(createTripReq));
    const createTripData = await getResponseJson(createTripRes as unknown as Response);

    expect((createTripRes as Response).status).toBe(201);
    expect(createTripData.data.orderCount).toBe(2);
    expect(createTripData.data.loadWeightKg).toBe(400);

    const tripId = createTripData.data._id.toString();
    const statusReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/fleet-trips/${tripId}/status`,
      transporter._id.toString(),
      {
        method: 'PATCH',
        body: { status: 'on_transit', location: 'Enugu', note: 'Departed warehouse' },
        role: 'transporter',
        email: transporter.email
      }
    );
    const statusRes = await import('@/app/api/transporters/fleet-trips/[tripId]/status/route').then((m) =>
      m.PATCH(statusReq, { params: { tripId } })
    );
    expect((statusRes as Response).status).toBe(200);

    const updatedOrderA: any = await Order.findById(orderA._id);
    const updatedOrderB: any = await Order.findById(orderB._id);
    expect(updatedOrderA.transportStatus).toBe('on_transit');
    expect(updatedOrderB.transportStatus).toBe('on_transit');

    const trackingReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/fleet-trips/${tripId}/tracking`,
      transporter._id.toString(),
      { method: 'GET', role: 'transporter', email: transporter.email }
    );
    const trackingRes = await import('@/app/api/transporters/fleet-trips/[tripId]/tracking/route').then((m) =>
      m.GET(trackingReq, { params: { tripId } })
    );
    const trackingData = await getResponseJson(trackingRes as unknown as Response);

    expect((trackingRes as Response).status).toBe(200);
    expect(trackingData.data.status).toBe('on_transit');
    expect(trackingData.data.timeline.length).toBe(2);
  });

  it('auto-creates a shared-load fleet trip when approved bookings fill truck capacity and releases capacity on delivery', async () => {
    const { user: admin } = await createAdmin();
    const { user: transporter } = await createTransporter();
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id, unit: 'tonne' });
    const orderA = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 15 }],
      totalAmount: 15000,
      status: 'paid',
      transportStatus: 'pending'
    });
    const orderB = await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 15 }],
      totalAmount: 15000,
      status: 'paid',
      transportStatus: 'pending'
    });
    const truck = await createTruck({
      transporter: transporter._id,
      capacity: '30 tonnes',
      pricingModel: 'per_tonne',
      wholeTruckOnly: false
    } as any);

    const bookingA = await FleetBooking.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      amount: 10000,
      loadWeightKg: 15000,
      shipmentItems: [{
        orderId: orderA._id,
        productId: product._id,
        productName: product.name,
        quantity: 15,
        unit: 'tonne',
        loadWeightKg: 15000
      }],
      wholeTruckOnly: false,
      status: 'pending_payment'
    });
    const paymentA = await FleetPayment.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      booking: bookingA._id,
      amount: 10000,
      loadWeightKg: 15000,
      shipmentItems: bookingA.shipmentItems,
      wholeTruckOnly: false,
      paymentMethod: 'bank_transfer',
      status: 'pending'
    });
    bookingA.payment = paymentA._id;
    await bookingA.save();

    const bookingB = await FleetBooking.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      amount: 10000,
      loadWeightKg: 15000,
      shipmentItems: [{
        orderId: orderB._id,
        productId: product._id,
        productName: product.name,
        quantity: 15,
        unit: 'tonne',
        loadWeightKg: 15000
      }],
      wholeTruckOnly: false,
      status: 'pending_payment'
    });
    const paymentB = await FleetPayment.create({
      fleet: truck._id,
      transporter: transporter._id,
      buyer: buyer._id,
      booking: bookingB._id,
      amount: 10000,
      loadWeightKg: 15000,
      shipmentItems: bookingB.shipmentItems,
      wholeTruckOnly: false,
      paymentMethod: 'bank_transfer',
      status: 'pending'
    });
    bookingB.payment = paymentB._id;
    await bookingB.save();

    const approvePayment = async (paymentId: any) => {
      const req = createAuthenticatedRequest(
        `http://localhost:3000/api/fleet-payments/${paymentId}/status`,
        admin._id.toString(),
        { method: 'PATCH', body: { status: 'approved' }, role: 'admin', email: admin.email }
      );
      return import('@/app/api/fleet-payments/[id]/status/route').then((m) =>
        m.PATCH(req, { params: { id: paymentId.toString() } })
      );
    };

    const firstApprovalRes = await approvePayment(paymentA._id);
    expect((firstApprovalRes as Response).status).toBe(200);
    expect(await FleetTrip.countDocuments()).toBe(0);

    const secondApprovalRes = await approvePayment(paymentB._id);
    expect((secondApprovalRes as Response).status).toBe(200);

    const trip = await FleetTrip.findOne({ fleet: truck._id });
    expect(trip).toBeTruthy();
    expect(trip!.bookingIds.length).toBe(2);
    expect(trip!.loadWeightKg).toBe(30000);

    const loadedTruck: any = await Truck.findById(truck._id);
    expect(loadedTruck.currentLoadKg).toBe(30000);

    const deliverReq = createAuthenticatedRequest(
      `http://localhost:3000/api/transporters/fleet-trips/${trip!._id}/status`,
      transporter._id.toString(),
      {
        method: 'PATCH',
        body: { status: 'delivered', location: 'Lagos', note: 'Delivered successfully' },
        role: 'transporter',
        email: transporter.email
      }
    );
    const deliverRes = await import('@/app/api/transporters/fleet-trips/[tripId]/status/route').then((m) =>
      m.PATCH(deliverReq, { params: { tripId: trip!._id.toString() } })
    );
    expect((deliverRes as Response).status).toBe(200);

    const releasedTruck: any = await Truck.findById(truck._id);
    expect(releasedTruck.currentLoadKg).toBe(0);
  });
});
