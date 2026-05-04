import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import TrackingEvent from '@/models/trackingEvent';
import FleetTrip from '@/models/fleetTrip';
import mongoose from 'mongoose';
import { appendFleetTripTrackingEvent, mapTripStatusToOrderTransportStatus, syncTripOrders } from '@/lib/fleetTrip';

const TRANSPORT_STATUS = ['pending', 'picked', 'on_transit', 'delivered'] as const;
const ORDER_TO_TRIP_STATUS: Record<string, 'planned' | 'loaded' | 'on_transit' | 'delivered'> = {
  pending: 'planned',
  picked: 'loaded',
  on_transit: 'on_transit',
  delivered: 'delivered'
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> | { orderId: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { orderId } = await Promise.resolve(params);
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const existingOrder = await Order.findById(orderId).populate('products.product');
  if (!existingOrder) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  const isTransporter =
    ensureActiveRole(user, 'transporter') && existingOrder.transporter?.toString() === user._id.toString();
  const sellerIds = (existingOrder.products || [])
    .map((p: any) => p?.product?.owner?.toString?.())
    .filter(Boolean);
  const isSeller = ensureActiveRole(user, 'agent') && sellerIds.includes(user._id.toString());
  const isAdmin = ensureActiveRole(user, 'admin');

  if (!isTransporter && !isSeller && !isAdmin) {
    return NextResponse.json(
      { success: false, message: 'Transporter, seller, or admin access required for this order' },
      { status: 403 }
    );
  }

  const body: any = await request.json().catch(() => ({}));
  const transportStatus = body?.transportStatus;
  if (!TRANSPORT_STATUS.includes(transportStatus)) {
    return NextResponse.json({ success: false, message: 'Invalid transport status' }, { status: 400 });
  }

  if (existingOrder.fleetTripId) {
    const trip = await FleetTrip.findById(existingOrder.fleetTripId);
    if (!trip) {
      return NextResponse.json({ success: false, message: 'Fleet trip not found for this order' }, { status: 404 });
    }
    if (ensureActiveRole(user, 'transporter') && trip.transporter?.toString() !== user._id.toString()) {
      return NextResponse.json({ success: false, message: 'Not authorized for this fleet trip' }, { status: 403 });
    }

    trip.status = ORDER_TO_TRIP_STATUS[transportStatus];
    trip.currentLocation = body?.location ?? trip.currentLocation ?? null;
    if (trip.status === 'on_transit' && !trip.startedAt) {
      trip.startedAt = new Date();
    }
    if (trip.status === 'delivered') {
      trip.completedAt = new Date();
    }
    trip.updatedAt = new Date();
    await trip.save();

    await appendFleetTripTrackingEvent({
      tripId: trip._id,
      status: trip.status,
      note: body?.note || '',
      location: body?.location || '',
      updatedBy: user._id,
      updatedByRole: user.activeRole || null
    });
    await syncTripOrders(trip._id, trip.status);

    return NextResponse.json({
      success: true,
      data: {
        _id: existingOrder._id,
        transportStatus: mapTripStatusToOrderTransportStatus(trip.status),
        status: existingOrder.status,
        fleetTripId: trip._id,
        latestTrackingEvent: {
          status: trip.status,
          note: body?.note || '',
          location: body?.location || '',
          updatedByRole: user.activeRole || null,
        }
      }
    }, { status: 200 });
  }

  const order = await Order.findOneAndUpdate(
    { _id: orderId },
    { $set: { transportStatus, updatedAt: new Date() } },
    { new: true }
  );
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  await TrackingEvent.create({
    order: order._id,
    status: transportStatus,
    note: body?.note || '',
    location: body?.location || '',
  });

  return NextResponse.json({
    success: true,
    data: {
      _id: order._id,
      transportStatus: order.transportStatus,
      status: order.status,
      order,
      latestTrackingEvent: {
        status: transportStatus,
        note: body?.note || '',
        location: body?.location || '',
        updatedByRole: user.activeRole || null,
      }
    }
  }, { status: 200 });
}
