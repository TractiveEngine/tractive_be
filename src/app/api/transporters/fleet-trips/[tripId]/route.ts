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
import '@/models/truck';
import '@/models/order';
import '@/models/driver';
import '@/models/fleetBooking';
import { buildFleetTripLoadMeta } from '@/lib/fleetTrip';
import { buildBuyerSummaries, buildFleetTripPackages, buildTransporterSummaryWithStats } from '@/lib/fleetTripView';

function getDocId(value: any) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

async function serializeTrip(trip: any) {
  const tripObject = trip.toObject();
  const packages = await buildFleetTripPackages(tripObject.bookingIds || []);
  return {
    ...tripObject,
    ...buildFleetTripLoadMeta(tripObject.loadWeightKg),
    transporter: await buildTransporterSummaryWithStats(tripObject.transporter),
    buyers: buildBuyerSummaries(tripObject.buyerIds),
    packages,
    packageCount: packages.length,
    buyerCount: Array.isArray(tripObject.buyerIds) ? tripObject.buyerIds.length : 0,
    orderCount: Array.isArray(tripObject.orderIds) ? tripObject.orderIds.length : 0
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> | { tripId: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return authenticationRequiredResponse();
  }

  const { tripId } = await Promise.resolve(params);
  if (!tripId || !mongoose.Types.ObjectId.isValid(tripId)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet trip id' }, { status: 400 });
  }

  const trip = await FleetTrip.findById(tripId)
    .populate('fleet', '_id plateNumber fleetName fleetNumber model route')
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
    return roleAccessRequiredResponse(['buyer', 'transporter', 'admin']);
  }

  return NextResponse.json({ success: true, data: await serializeTrip(trip) }, { status: 200 });
}
