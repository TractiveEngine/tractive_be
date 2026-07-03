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
import { appendFleetTripTrackingEvent } from '@/lib/fleetTrip';

function getDocId(value: any) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

export async function POST(
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

  const trip = await FleetTrip.findById(tripId).select('_id transporter status currentLocation currentLatitude currentLongitude');
  if (!trip) {
    return NextResponse.json({ success: false, message: 'Fleet trip not found' }, { status: 404 });
  }
  if (ensureActiveRole(user, 'transporter') && getDocId((trip as any).transporter) !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized for this fleet trip' }, { status: 403 });
  }

  const body: any = await request.json().catch(() => ({}));
  const lat = body?.lat;
  const lng = body?.lng;
  const location = typeof body?.location === 'string' ? body.location.trim() : '';
  const timestamp = body?.timestamp ? new Date(body.timestamp) : new Date();

  if (typeof lat !== 'number' || Number.isNaN(lat) || typeof lng !== 'number' || Number.isNaN(lng)) {
    return NextResponse.json({ success: false, message: 'lat and lng are required numbers' }, { status: 400 });
  }
  if (Number.isNaN(timestamp.getTime())) {
    return NextResponse.json({ success: false, message: 'timestamp must be a valid ISO date' }, { status: 400 });
  }

  trip.currentLatitude = lat;
  trip.currentLongitude = lng;
  trip.currentLocation = location || trip.currentLocation || '';
  trip.updatedAt = new Date();
  await trip.save();

  await appendFleetTripTrackingEvent({
    tripId: trip._id,
    status: trip.status || 'planned',
    note: typeof body?.note === 'string' ? body.note : 'Location update',
    location,
    latitude: lat,
    longitude: lng,
    updatedBy: user._id,
    updatedByRole: user.activeRole || null
  });

  return NextResponse.json({
    success: true,
    data: {
      tripId: trip._id,
      status: trip.status,
      currentLocation: {
        lat,
        lng,
        label: trip.currentLocation || ''
      },
      locationLabel: trip.currentLocation || '',
      lastUpdatedAt: timestamp.toISOString()
    }
  }, { status: 200 });
}
