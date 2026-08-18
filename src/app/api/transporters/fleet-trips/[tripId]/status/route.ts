import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import {
  authenticationRequiredResponse,
  ensureActiveRole,
  getAuthUser,
  roleAccessRequiredResponse
} from '@/lib/apiAuth';
import FleetTrip from '@/models/fleetTrip';
import { appendFleetTripTrackingEvent, mapTripStatusToOrderTransportStatus, releaseTripResources, syncTripOrders } from '@/lib/fleetTrip';

const TRIP_STATUS = ['planned', 'loaded', 'on_transit', 'arrived', 'delivered', 'cancelled'] as const;
const STATUS_ALIASES: Record<string, typeof TRIP_STATUS[number]> = {
  picked: 'loaded'
};

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
    return authenticationRequiredResponse();
  }
  if (!ensureActiveRole(user, 'transporter') && !ensureActiveRole(user, 'admin')) {
    return roleAccessRequiredResponse(['transporter', 'admin']);
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
  const requestedStatus = body?.status;
  const status = requestedStatus ? (STATUS_ALIASES[requestedStatus] || requestedStatus) : trip.status;
  const lat = body?.lat;
  const lng = body?.lng;
  const estDeliveryDateInput = body?.estDeliveryDate ?? body?.estimatedDeliveryDate;
  const estDeliveryDate =
    estDeliveryDateInput === undefined || estDeliveryDateInput === null || estDeliveryDateInput === ''
      ? undefined
      : new Date(estDeliveryDateInput);
  if (!requestedStatus && lat === undefined && lng === undefined && estDeliveryDateInput === undefined && body?.origin === undefined && body?.destination === undefined && body?.location === undefined && body?.note === undefined) {
    return NextResponse.json({ success: false, message: 'Provide at least one trip field to update' }, { status: 400 });
  }
  if (!TRIP_STATUS.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid trip status' }, { status: 400 });
  }
  if (lat !== undefined && (typeof lat !== 'number' || Number.isNaN(lat))) {
    return NextResponse.json({ success: false, message: 'lat must be a valid number' }, { status: 400 });
  }
  if (lng !== undefined && (typeof lng !== 'number' || Number.isNaN(lng))) {
    return NextResponse.json({ success: false, message: 'lng must be a valid number' }, { status: 400 });
  }
  if (estDeliveryDate && Number.isNaN(estDeliveryDate.getTime())) {
    return NextResponse.json({ success: false, message: 'estDeliveryDate must be a valid ISO date' }, { status: 400 });
  }
  const previousStatus = trip.status;

  trip.status = status;
  if (typeof body?.origin === 'string') {
    trip.origin = body.origin.trim() || null;
  }
  if (typeof body?.destination === 'string') {
    trip.destination = body.destination.trim() || null;
  }
  trip.currentLocation = body?.location ?? trip.currentLocation ?? null;
  trip.currentLatitude = typeof lat === 'number' ? lat : trip.currentLatitude ?? null;
  trip.currentLongitude = typeof lng === 'number' ? lng : trip.currentLongitude ?? null;
  if (estDeliveryDate !== undefined) {
    trip.estimatedDeliveryDate = estDeliveryDate;
  }
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
    await releaseTripResources(trip, status);
  }

  await appendFleetTripTrackingEvent({
    tripId: trip._id,
    status,
    note: body?.note || '',
    location: body?.location || '',
    latitude: typeof lat === 'number' ? lat : null,
    longitude: typeof lng === 'number' ? lng : null,
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
      origin: trip.origin || null,
      destination: trip.destination || null,
      currentLocation: trip.currentLocation || '',
      currentLatitude: trip.currentLatitude ?? null,
      currentLongitude: trip.currentLongitude ?? null,
      estDeliveryDate: trip.estimatedDeliveryDate || null,
      latestTrackingEvent: {
        status,
        requestedStatus: requestedStatus || status,
        note: body?.note || '',
        location: body?.location || '',
        latitude: typeof lat === 'number' ? lat : null,
        longitude: typeof lng === 'number' ? lng : null,
        updatedByRole: user.activeRole || null
      }
    }
  }, { status: 200 });
}
