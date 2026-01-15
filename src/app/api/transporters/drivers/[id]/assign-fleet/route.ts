import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Driver from '@/models/driver';
import Truck from '@/models/truck';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = params; // driver id
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid driver id' }, { status: 400 });
  }

  const { truckId } = await request.json();
  if (!truckId || !mongoose.Types.ObjectId.isValid(truckId)) {
    return NextResponse.json({ success: false, message: 'Invalid truck id' }, { status: 400 });
  }

  const driver = await Driver.findOne({ _id: id, transporter: user._id });
  if (!driver) {
    return NextResponse.json({ success: false, message: 'Driver not found' }, { status: 404 });
  }

  const truck = await Truck.findOne({ _id: truckId, transporter: user._id });
  if (!truck) {
    return NextResponse.json({ success: false, message: 'Truck not found' }, { status: 404 });
  }

  driver.assignedTruck = truck._id;
  truck.assignedDriver = driver._id;
  await driver.save();
  await truck.save();

  return NextResponse.json({ success: true, data: { driver, truck } }, { status: 200 });
}
