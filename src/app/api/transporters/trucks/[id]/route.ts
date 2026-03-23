import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Truck from '@/models/truck';
import { getAuthUser } from '@/lib/apiAuth';
import mongoose from 'mongoose';
import { buildCapacityMeta } from '@/lib/truckCapacity';

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
  return NextResponse.json({ success: true, data: { ...truckObj, ...buildCapacityMeta(truckObj) } }, { status: 200 });
}
