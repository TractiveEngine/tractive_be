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

  const body = await request.json();
  const plateNumber = body.plateNumber || body.fleetNumber;
  if (!plateNumber) {
    return NextResponse.json({ success: false, message: 'plateNumber or fleetNumber required' }, { status: 400 });
  }

  const truck = await Truck.create({
    plateNumber,
    fleetName: body.fleetName || body.name || body.model,
    fleetNumber: body.fleetNumber || plateNumber,
    iot: body.iot || body.Iot || body.tracker,
    model: body.model || body.fleetName || body.name,
    size: body.size,
    capacity: body.capacity || body.size,
    price: body.price,
    priceNegotiation: !!body.priceNegotiation,
    images: Array.isArray(body.images) ? body.images : [],
    fleetDescription: body.fleetDescription,
    fleetStates: body.fleetStates,
    transporter: user._id,
    route: body.route || {
      fromState: body.fromState || null,
      toState: body.toState || null
    },
  });

  return NextResponse.json({ success: true, data: truck }, { status: 201 });
}
