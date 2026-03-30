import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Truck from '@/models/truck';
import { getAuthUser } from '@/lib/apiAuth';
import mongoose from 'mongoose';
import { buildCapacityMeta } from '@/lib/truckCapacity';
import { buildFleetPricingMeta } from '@/lib/fleetPricing';
import { buildEstimatedDeliveryMeta } from '@/lib/estimatedDelivery';
import { getFleetBidSummaries } from '@/lib/fleetBidSummary';

// GET /api/transporters/trucks/:id
export async function GET(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid truck id' }, { status: 400 });
  }

  const truck = await Truck.findById(id);
  if (!truck) {
    return NextResponse.json({ success: false, message: 'Truck not found' }, { status: 404 });
  }

  const truckObj = truck.toObject();
  const bidSummaries = await getFleetBidSummaries([truck._id]);
  return NextResponse.json({
    success: true,
    data: {
      ...truckObj,
      ...buildCapacityMeta(truckObj),
      ...buildFleetPricingMeta(truckObj),
      ...buildEstimatedDeliveryMeta(truckObj),
      bidSummary: bidSummaries.get(truck._id.toString()) || null
    }
  }, { status: 200 });
}
