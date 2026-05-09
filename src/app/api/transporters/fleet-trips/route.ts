import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import FleetTrip from '@/models/fleetTrip';
import Truck from '@/models/truck';
import FleetBooking from '@/models/fleetBooking';
import '@/models/order';
import '@/models/driver';
import { buildFleetTripLoadMeta, createFleetTripFromConfirmedBookings } from '@/lib/fleetTrip';
import { buildBuyerSummaries, buildFleetTripPackages, buildTransporterSummary } from '@/lib/fleetTripView';

async function serializeTrip(trip: any) {
  const tripObject = trip.toObject();
  const packages = await buildFleetTripPackages(tripObject.bookingIds || []);
  return {
    ...tripObject,
    ...buildFleetTripLoadMeta(tripObject.loadWeightKg),
    transporter: buildTransporterSummary(tripObject.transporter),
    buyers: buildBuyerSummaries(tripObject.buyerIds),
    packages,
    packageCount: packages.length,
    buyerCount: Array.isArray(tripObject.buyerIds) ? tripObject.buyerIds.length : 0,
    orderCount: Array.isArray(tripObject.orderIds) ? tripObject.orderIds.length : 0
  };
}

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter') && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Transporter or admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
  const skip = (page - 1) * limit;
  const status = searchParams.get('status');
  const fleetId = searchParams.get('fleetId');
  const search = searchParams.get('search');

  const query: Record<string, unknown> = {};
  if (ensureActiveRole(user, 'transporter')) {
    query.transporter = user._id;
  }
  if (status && ['planned', 'loaded', 'on_transit', 'arrived', 'delivered', 'cancelled'].includes(status)) {
    query.status = status;
  }
  if (fleetId && mongoose.Types.ObjectId.isValid(fleetId)) {
    query.fleet = fleetId;
  }
  if (search) {
    query.trackingCode = { $regex: search, $options: 'i' };
  }

  const [trips, total] = await Promise.all([
    FleetTrip.find(query)
      .populate('fleet', '_id plateNumber fleetName fleetNumber model route')
      .populate('transporter', '_id name businessName phone email address state image')
      .populate('driver', '_id name phone trackingNumber')
      .populate('bookingIds', '_id shipmentItems')
      .populate('buyerIds', '_id name email phone businessName address state image')
      .populate('orderIds', '_id buyer transportStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    FleetTrip.countDocuments(query)
  ]);

  const serializedTrips = await Promise.all(trips.map(serializeTrip));
  return NextResponse.json({
    success: true,
    data: serializedTrips,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  }, { status: 200 });
}

export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter') && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Transporter or admin access required' }, { status: 403 });
  }

  const body: any = await request.json().catch(() => ({}));
  const fleetId = body?.fleetId;
  let bookingIds = Array.isArray(body?.bookingIds) ? body.bookingIds : [];
  if (!fleetId || !mongoose.Types.ObjectId.isValid(fleetId)) {
    return NextResponse.json({ success: false, message: 'Valid fleetId is required' }, { status: 400 });
  }

  const fleet = await Truck.findById(fleetId).select('_id transporter route');
  if (!fleet) {
    return NextResponse.json({ success: false, message: 'Fleet not found' }, { status: 404 });
  }
  if (ensureActiveRole(user, 'transporter') && fleet.transporter?.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized for this fleet' }, { status: 403 });
  }

  if (bookingIds.length === 0) {
    const availableBookings = await FleetBooking.find({
      fleet: fleet._id,
      status: 'confirmed',
      fleetTripId: null
    }).select('_id');
    bookingIds = availableBookings.map((booking: any) => booking._id.toString());
  }
  if (bookingIds.length === 0 || bookingIds.some((id: any) => !mongoose.Types.ObjectId.isValid(id))) {
    return NextResponse.json({ success: false, message: 'At least one valid bookingId is required' }, { status: 400 });
  }

  try {
    const trip = await createFleetTripFromConfirmedBookings({
      fleetId: fleet._id,
      bookingIds,
      driverId: body?.driverId,
      origin: body?.origin ?? fleet.route?.fromState ?? null,
      destination: body?.destination ?? fleet.route?.toState ?? null,
      createdBy: user._id
    });

    const populatedTrip = await FleetTrip.findById(trip._id)
      .populate('fleet', '_id plateNumber fleetName fleetNumber model route')
      .populate('transporter', '_id name businessName phone email address state image')
      .populate('driver', '_id name phone trackingNumber')
      .populate('bookingIds', '_id shipmentItems')
      .populate('buyerIds', '_id name email phone businessName address state image')
      .populate('orderIds', '_id buyer transportStatus');

    return NextResponse.json({ success: true, data: await serializeTrip(populatedTrip) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Failed to create fleet trip' }, { status: 400 });
  }
}
