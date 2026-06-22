import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import FleetTrip from '@/models/fleetTrip';
import FleetTripTrackingEvent from '@/models/fleetTripTrackingEvent';
import '@/models/truck';
import '@/models/order';
import '@/models/driver';
import '@/models/fleetBooking';
import { buildBuyerSummaries, buildFleetTripPackages, buildTransporterSummary } from '@/lib/fleetTripView';
import { buildTrackingSummaryFromEvents, computeEstimatedDeliveryDate } from '@/lib/orderView';

function getDocId(value: any) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> | { tripId: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { tripId } = await Promise.resolve(params);
  if (!tripId || !mongoose.Types.ObjectId.isValid(tripId)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet trip id' }, { status: 400 });
  }

  const trip = await FleetTrip.findById(tripId)
    .populate('fleet', '_id plateNumber fleetName fleetNumber iot tracker model route images estimatedDeliveryValue estimatedDeliveryUnit')
    .populate('transporter', '_id name businessName phone email address state image')
    .populate('driver', '_id name phone trackingNumber')
    .populate('bookingIds', '_id shipmentItems')
    .populate('buyerIds', '_id name email phone businessName address state image')
    .populate('orderIds', '_id buyer transportStatus');
  if (!trip) {
    return NextResponse.json({ success: false, message: 'Fleet trip not found' }, { status: 404 });
  }

  const isTransporter = ensureActiveRole(user, 'transporter') && getDocId((trip as any).transporter) === user._id.toString();
  const isAdmin = ensureActiveRole(user, 'admin');
  const isBuyer = ensureActiveRole(user, 'buyer') && trip.buyerIds.some((buyer: any) => buyer._id.toString() === user._id.toString());
  if (!isTransporter && !isAdmin && !isBuyer) {
    return NextResponse.json({ success: false, message: 'Not authorized to view this tracking timeline' }, { status: 403 });
  }

  const timeline = await FleetTripTrackingEvent.find({ fleetTrip: trip._id }).sort({ createdAt: 1 }).lean();
  const packages = await buildFleetTripPackages((trip as any).bookingIds || []);
  const trackingSummary = buildTrackingSummaryFromEvents(timeline, {
    estDeliveryDate: computeEstimatedDeliveryDate(trip)
  });
  const currentLocationLabel = trip.currentLocation || '';
  return NextResponse.json({
    success: true,
    data: {
      tripId: trip._id.toString(),
      trackingCode: trip.trackingCode,
      fleetId: trip.fleet?._id?.toString?.() || null,
      status: trip.status,
      origin: trip.origin || null,
      destination: trip.destination || null,
      currentLocation: {
        lat: trip.currentLatitude ?? null,
        lng: trip.currentLongitude ?? null,
        label: currentLocationLabel
      },
      currentLatitude: trip.currentLatitude ?? null,
      currentLongitude: trip.currentLongitude ?? null,
      locationLabel: currentLocationLabel,
      fleet: trip.fleet,
      transporter: buildTransporterSummary((trip as any).transporter),
      driver: (trip as any).driver ? {
        id: (trip as any).driver._id,
        name: (trip as any).driver.name || 'Unknown',
        phone: (trip as any).driver.phone || null,
        trackingNumber: (trip as any).driver.trackingNumber || null
      } : null,
      buyers: buildBuyerSummaries((trip as any).buyerIds),
      orders: (trip.orderIds || []).map((order: any) => ({
        id: order._id,
        buyerId: order.buyer?.toString?.() || order.buyer,
        transportStatus: order.transportStatus
      })),
      packages,
      ...trackingSummary,
      timeline: timeline.map((event) => ({
        status: event.status,
        timestamp: event.createdAt,
        note: event.note || '',
        location: event.location || '',
        lat: (event as any).latitude ?? null,
        lng: (event as any).longitude ?? null
      }))
    }
  }, { status: 200 });
}
