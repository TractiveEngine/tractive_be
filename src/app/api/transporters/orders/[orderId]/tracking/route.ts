import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import TrackingEvent from '@/models/trackingEvent';
import FleetTrip from '@/models/fleetTrip';
import FleetTripTrackingEvent from '@/models/fleetTripTrackingEvent';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';
import { mapTripStatusToOrderTransportStatus } from '@/lib/fleetTrip';
import { buildTrackingSummaryFromEvents, computeEstimatedDeliveryDate } from '@/lib/orderView';

export async function GET(
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

  const order = await Order.findById(orderId).populate('products.product');
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  const isBuyer = ensureActiveRole(user, 'buyer') && order.buyer?.toString() === user._id.toString();
  const isTransporter = ensureActiveRole(user, 'transporter') && order.transporter?.toString() === user._id.toString();
  const sellerIds = (order.products || [])
    .map((p: any) => p?.product?.owner?.toString?.())
    .filter(Boolean);
  const isSeller = ensureActiveRole(user, 'agent') && sellerIds.includes(user._id.toString());
  const isAdmin = ensureActiveRole(user, 'admin');

  if (!isBuyer && !isTransporter && !isSeller && !isAdmin) {
    return NextResponse.json({ success: false, message: 'Not authorized to view this tracking timeline' }, { status: 403 });
  }

  if (order.fleetTripId) {
    const trip = await FleetTrip.findById(order.fleetTripId)
      .populate('fleet', '_id estimatedDeliveryValue estimatedDeliveryUnit')
      .select('_id fleet trackingCode status currentLocation currentLatitude currentLongitude startedAt createdAt updatedAt');
    if (trip) {
      const tripTimeline = await FleetTripTrackingEvent.find({ fleetTrip: trip._id }).sort({ createdAt: 1 }).lean();
      const trackingSummary = buildTrackingSummaryFromEvents(tripTimeline, {
        estDeliveryDate: computeEstimatedDeliveryDate(trip)
      });
      const currentLocationLabel = trip.currentLocation || '';
      return NextResponse.json(
        {
          success: true,
          data: {
            orderId: order._id.toString(),
            fleetTripId: trip._id.toString(),
            fleetId: trip.fleet?.toString?.() || trip.fleet || null,
            trackingCode: trip.trackingCode || null,
            transportStatus: mapTripStatusToOrderTransportStatus(trip.status),
            currentLocation: {
              lat: trip.currentLatitude ?? null,
              lng: trip.currentLongitude ?? null,
              label: currentLocationLabel
            },
            currentLocationLabel,
            ...trackingSummary,
            timeline: tripTimeline.map((t) => ({
              status: t.status,
              timestamp: t.createdAt,
              note: t.note,
              location: t.location,
              lat: (t as any).latitude ?? null,
              lng: (t as any).longitude ?? null
            })),
          },
        },
        { status: 200 }
      );
    }
  }

  const timeline = await TrackingEvent.find({ order: order._id }).sort({ createdAt: 1 }).lean();
  const trackingSummary = buildTrackingSummaryFromEvents(timeline);
  const currentLocationLabel = timeline.length > 0 ? (timeline[timeline.length - 1] as any).location || '' : '';

  return NextResponse.json(
    {
      success: true,
      data: {
        orderId: order._id.toString(),
        transportStatus: order.transportStatus,
        currentLocation: {
          lat: null,
          lng: null,
          label: currentLocationLabel
        },
        currentLocationLabel,
        ...trackingSummary,
        timeline: timeline.map((t) => ({
          status: t.status,
          timestamp: t.createdAt,
          note: t.note,
          location: t.location,
          lat: null,
          lng: null
        })),
      },
    },
    { status: 200 }
  );
}
