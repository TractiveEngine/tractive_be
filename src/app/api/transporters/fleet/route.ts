import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Truck from '@/models/truck';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import { parseCapacityToKg } from '@/lib/truckCapacity';

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  const query: Record<string, unknown> = { transporter: user._id };
  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [
      { plateNumber: regex },
      { fleetName: regex },
      { fleetNumber: regex },
      { model: regex },
      { iot: regex }
    ];
  }
  if (status) {
    query.status = status;
  }
  if (year || month) {
    const createdAt: Record<string, Date> = {};
    const parsedYear = year ? Number(year) : undefined;
    const parsedMonth = month ? Number(month) : undefined;
    if (parsedYear && parsedMonth && parsedMonth >= 1 && parsedMonth <= 12) {
      createdAt.$gte = new Date(parsedYear, parsedMonth - 1, 1);
      createdAt.$lt = new Date(parsedYear, parsedMonth, 1);
    } else if (parsedYear) {
      createdAt.$gte = new Date(parsedYear, 0, 1);
      createdAt.$lt = new Date(parsedYear + 1, 0, 1);
    }
    if (Object.keys(createdAt).length > 0) {
      query.createdAt = createdAt;
    }
  }

  const trucks = await Truck.find(query).sort({ createdAt: -1 });
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
    capacityKg:
      typeof body.capacityKg === 'number'
        ? body.capacityKg
        : parseCapacityToKg(body.capacity || body.size),
    currentLoadKg:
      typeof body.currentLoadKg === 'number' && body.currentLoadKg >= 0
        ? body.currentLoadKg
        : 0,
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
