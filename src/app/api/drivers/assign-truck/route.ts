import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Driver from '@/models/driver';
import Truck from '@/models/truck';
import User from '@/models/user';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string' || !decoded.userId) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  await dbConnect();
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('transporter')) {
    return NextResponse.json({ error: 'Only transporters can assign trucks' }, { status: 403 });
  }

  const { driverId, truckId } = await request.json();
  if (!driverId || !truckId) {
    return NextResponse.json({ error: 'Driver and truck IDs required' }, { status: 400 });
  }

  const driver = await Driver.findById(driverId);
  const truck = await Truck.findById(truckId);

  if (!driver || !truck) {
    return NextResponse.json({ error: 'Driver or truck not found' }, { status: 404 });
  }

  // Assign truck to driver and driver to truck
  driver.assignedTruck = truck._id;
  truck.assignedDriver = driver._id;
  await driver.save();
  await truck.save();

  return NextResponse.json({ message: 'Truck assigned to driver', driver, truck }, { status: 200 });
}
