import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Truck from '@/models/truck';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ error: 'Only transporters can onboard trucks' }, { status: 403 });
  }

  const { plateNumber, model, capacity, route } = await request.json();
  if (!plateNumber) {
    return NextResponse.json({ error: 'Plate number required' }, { status: 400 });
  }

  const truck = await Truck.create({
    plateNumber,
    model,
    capacity,
    transporter: user._id,
    route: route || {}
  });

  return NextResponse.json({ truck }, { status: 201 });
}

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ error: 'Only transporters can view trucks' }, { status: 403 });
  }

  const trucks = await Truck.find({ transporter: user._id });
  return NextResponse.json({ trucks }, { status: 200 });
}
