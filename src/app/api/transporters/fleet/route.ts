import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Truck from '@/models/truck';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const trucks = await Truck.find({ transporter: user._id }).sort({ createdAt: -1 });
  return NextResponse.json({ success: true, data: trucks }, { status: 200 });
}

export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { plateNumber, model, capacity, route } = await request.json();
  if (!plateNumber) {
    return NextResponse.json({ success: false, message: 'Plate number required' }, { status: 400 });
  }

  const truck = await Truck.create({
    plateNumber,
    model,
    capacity,
    transporter: user._id,
    route: route || {},
  });

  return NextResponse.json({ success: true, data: truck }, { status: 201 });
}
