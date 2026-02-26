import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Driver from '@/models/driver';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

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

  const drivers = await Driver.find({ transporter: user._id }).sort({ createdAt: -1 });
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

  const driver = await Driver.create({
    name,
    phone,
    licenseNumber,
    trackingNumber,
    transporter: user._id,
  });

  return NextResponse.json({ success: true, data: driver }, { status: 201 });
}
