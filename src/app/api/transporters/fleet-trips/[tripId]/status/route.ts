import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import FleetTrip from '@/models/fleetTrip';
import Truck from '@/models/truck';
import { appendFleetTripTrackingEvent, mapTripStatusToOrderTransportStatus, syncTripOrders } from '@/lib/fleetTrip';

const TRIP_STATUS = ['planned', 'loaded', 'on_transit', 'arrived', 'delivered', 'cancelled'] as const;

function getDocId(value: any) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> | { tripId: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter') && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Transporter or admin access required' }, { status: 403 });
  }

  const { tripId } = await Promise.resolve(params);
  if (!tripId || !mongoose.Types.ObjectId.isValid(tripId)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet trip id' }, { status: 400 });
  }

  const trip = await FleetTrip.findById(tripId);
  if (!trip) {
    return NextResponse.json({ success: false, message: 'Fleet trip not found' }, { status: 404 });
  }
  if (ensureActiveRole(user, 'transporter') && getDocId((trip as any).transporter) !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized for this fleet trip' }, { status: 403 });
  }

  const body: any = await request.json().catch(() => ({}));
  const status = body?.status;
  if (!TRIP_STATUS.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid trip status' }, { status: 400 });
  }
  const previousStatus = trip.status;

  trip.status = status;
  trip.currentLocation = body?.location ?? trip.currentLocation ?? null;
  if (status === 'on_transit' && !trip.startedAt) {
    trip.startedAt = new Date();
  }
  if (status === 'delivered') {
    trip.completedAt = new Date();
  }
  if (status === 'cancelled') {
    trip.cancelledAt = new Date();
  }
  trip.updatedAt = new Date();
  await trip.save();

  if (
    previousStatus !== 'delivered' &&
    previousStatus !== 'cancelled' &&
    (status === 'delivered' || status === 'cancelled')
  ) {
    const fleet = await Truck.findById((trip as any).fleet).select('_id currentLoadKg');
    if (fleet) {
      fleet.currentLoadKg = Math.max(0, Number(fleet.currentLoadKg || 0) - Number((trip as any).loadWeightKg || 0));
      fleet.updatedAt = new Date();
      await fleet.save();
    }
  }

  await appendFleetTripTrackingEvent({
    tripId: trip._id,
    status,
    note: body?.note || '',
    location: body?.location || '',
    updatedBy: user._id,
    updatedByRole: user.activeRole || null
  });
  await syncTripOrders(trip._id, status);

  return NextResponse.json({
    success: true,
    data: {
      _id: trip._id,
      status: trip.status,
      transportStatus: mapTripStatusToOrderTransportStatus(trip.status),
      currentLocation: trip.currentLocation || '',
      latestTrackingEvent: {
        status,
        note: body?.note || '',
        location: body?.location || '',
        updatedByRole: user.activeRole || null
      }
    }
  }, { status: 200 });
}
