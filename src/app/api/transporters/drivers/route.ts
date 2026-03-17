import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Driver from '@/models/driver';
import Truck from '@/models/truck';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

async function ensureTruckAvailableForDriver(truckId: string, transporterId: string, driverId?: string) {
  const truck = await Truck.findOne({ _id: truckId, transporter: transporterId });
  if (!truck) {
    return { error: NextResponse.json({ success: false, message: 'Assigned fleet not found' }, { status: 404 }) };
  }
  if (truck.assignedDriver && truck.assignedDriver.toString() !== driverId) {
    return { error: NextResponse.json({ success: false, message: 'Assigned fleet is already linked to another driver' }, { status: 409 }) };
  }
  return { truck };
}

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({
      success: false,
      message: 'Transporter access required',
      currentRole: user?.activeRole || null
    }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  const query: Record<string, unknown> = { transporter: user._id };
  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [{ name: regex }, { phone: regex }, { licenseNumber: regex }, { trackingNumber: regex }];
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

  const drivers = await Driver.find(query)
    .populate({
      path: 'assignedTruck',
      select: '_id plateNumber fleetName fleetNumber iot model size capacity price priceNegotiation fleetDescription fleetStates route status images'
    })
    .sort({ createdAt: -1 });
  return NextResponse.json({ success: true, data: drivers }, { status: 200 });
}

export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({
      success: false,
      message: 'Transporter access required',
      currentRole: user?.activeRole || null
    }, { status: 403 });
  }

  const body = await request.json();
  const name = body.name || body.fullName;
  const phone = body.phone || body.phoneNumber;
  const licenseNumber = body.licenseNumber;
  const trackingNumber = body.trackingNumber;
  if (!name || !licenseNumber) {
    return NextResponse.json({ success: false, message: 'Name and license number required' }, { status: 400 });
  }

  let assignedTruck = null;
  const requestedTruckId = body.assignedTruck || body.truckId || body.fleetId;
  if (requestedTruckId) {
    const { truck, error } = await ensureTruckAvailableForDriver(requestedTruckId, user._id.toString());
    if (error) {
      return error;
    }
    assignedTruck = truck;
  }

  const driver = await Driver.create({
    name,
    phone,
    licenseNumber,
    trackingNumber,
    transporter: user._id,
    assignedTruck: assignedTruck?._id || null,
  });

  if (assignedTruck) {
    assignedTruck.assignedDriver = driver._id;
    assignedTruck.updatedAt = new Date();
    await assignedTruck.save();
  }

  await driver.populate({
    path: 'assignedTruck',
    select: '_id plateNumber fleetName fleetNumber iot model size capacity price priceNegotiation fleetDescription fleetStates route status images'
  });

  return NextResponse.json({ success: true, data: driver }, { status: 201 });
}
