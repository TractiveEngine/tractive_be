import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Truck from '@/models/truck';
import { getAuthUser } from '@/lib/apiAuth';
import { buildCapacityMeta } from '@/lib/truckCapacity';
import { buildFleetPricingMeta } from '@/lib/fleetPricing';
import { buildEstimatedDeliveryMeta } from '@/lib/estimatedDelivery';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const authUser = await getAuthUser(request);

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet id' }, { status: 400 });
  }

  const fleet = await Truck.findById(id).lean();
  if (!fleet) {
    return NextResponse.json({ success: false, message: 'Fleet not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit')) || 8));

  const query: Record<string, unknown> = {
    _id: { $ne: fleet._id },
    status: 'available'
  };

  const routeStates = [fleet.route?.fromState, fleet.route?.toState].filter(Boolean);
  if (routeStates.length > 0) {
    query.$or = [
      { 'route.fromState': { $in: routeStates } },
      { 'route.toState': { $in: routeStates } },
      ...(fleet.model ? [{ model: fleet.model }] : [])
    ];
  } else if (fleet.model) {
    query.model = fleet.model;
  }

  const similar = await Truck.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({
    success: true,
    data: similar.map((truck: any) => ({
      ...truck,
      ...buildCapacityMeta(truck),
      ...buildFleetPricingMeta(truck),
      ...buildEstimatedDeliveryMeta(truck),
      isWishlisted: false,
      requestedBy: authUser?._id?.toString?.() || null
    }))
  }, { status: 200 });
}
