import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import FleetTrip from '@/models/fleetTrip';
import TrackingEvent from '@/models/trackingEvent';
import { appendFleetTripTrackingEvent } from '@/lib/fleetTrip';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> | { orderId: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter') && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Transporter or admin access required' }, { status: 403 });
  }

  const { orderId } = await Promise.resolve(params);
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const lat = body?.lat;
  const lng = body?.lng;
  const location = body?.location || body?.label || '';
  const timestamp = body?.timestamp ? new Date(body.timestamp) : new Date();

  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return NextResponse.json({ success: false, message: 'lat and lng are required numbers' }, { status: 400 });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }
  if (
    ensureActiveRole(user, 'transporter') &&
    order.transporter?.toString() !== user._id.toString()
  ) {
    return NextResponse.json({ success: false, message: 'Order not found or not assigned to you' }, { status: 404 });
  }

  if (order.fleetTripId) {
    const trip = await FleetTrip.findById(order.fleetTripId);
    if (!trip) {
      return NextResponse.json({ success: false, message: 'Fleet trip not found for this order' }, { status: 404 });
    }
    if (
      ensureActiveRole(user, 'transporter') &&
      trip.transporter?.toString() !== user._id.toString()
    ) {
      return NextResponse.json({ success: false, message: 'Not authorized for this fleet trip' }, { status: 403 });
    }

    trip.currentLatitude = Number(lat);
    trip.currentLongitude = Number(lng);
    if (location) {
      trip.currentLocation = location;
    }
    trip.updatedAt = timestamp;
    await trip.save();

    await appendFleetTripTrackingEvent({
      tripId: trip._id,
      status: trip.status,
      note: body?.note || 'Location update',
      location: location || trip.currentLocation || '',
      latitude: Number(lat),
      longitude: Number(lng),
      updatedBy: user._id,
      updatedByRole: user.activeRole || null
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: order._id,
        fleetTripId: trip._id,
        currentLocation: {
          lat: trip.currentLatitude,
          lng: trip.currentLongitude,
          label: trip.currentLocation || ''
        },
        lastUpdatedAt: timestamp.toISOString()
      }
    }, { status: 200 });
  }

  await TrackingEvent.create({
    order: order._id,
    status: order.transportStatus,
    note: body?.note || 'Location update',
    location: location || `${Number(lat)}, ${Number(lng)}`,
    createdAt: timestamp
  });

  return NextResponse.json({
    success: true,
    data: {
      orderId: order._id,
      currentLocation: {
        lat: Number(lat),
        lng: Number(lng),
        label: location || ''
      },
      lastUpdatedAt: timestamp.toISOString(),
      persistedToTrip: false
    }
  }, { status: 200 });
}

