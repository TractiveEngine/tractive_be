import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Driver from '@/models/driver';
import Truck from '@/models/truck';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams; // driver id
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid driver id' }, { status: 400 });
  }

  const { truckId } = await request.json();
  if (!truckId || !mongoose.Types.ObjectId.isValid(truckId)) {
    return NextResponse.json({ success: false, message: 'Invalid truck id' }, { status: 400 });
  }

  const driver = await Driver.findById(id);
  if (!driver) {
    return NextResponse.json({ success: false, message: 'Driver not found' }, { status: 404 });
  }
  if (driver.transporter?.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized for this driver' }, { status: 403 });
  }

  const truck = await Truck.findById(truckId);
  if (!truck) {
    return NextResponse.json({ success: false, message: 'Truck not found' }, { status: 404 });
  }
  if (truck.transporter?.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized for this truck' }, { status: 403 });
  }

  driver.assignedTruck = truck._id;
  truck.assignedDriver = driver._id;
  await driver.save();
  await truck.save();

  return NextResponse.json({ success: true, data: { driver, truck } }, { status: 200 });
}
