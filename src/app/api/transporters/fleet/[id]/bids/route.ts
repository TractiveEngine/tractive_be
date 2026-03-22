import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import Truck from '@/models/truck';
import FleetBid from '@/models/fleetBid';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet id' }, { status: 400 });
  }

  const fleet = await Truck.findById(id).select('_id transporter');
  if (!fleet) {
    return NextResponse.json({ success: false, message: 'Fleet not found' }, { status: 404 });
  }

  const query: Record<string, unknown> = { fleet: fleet._id };
  if (ensureActiveRole(user, 'transporter')) {
    if (fleet.transporter?.toString() !== user._id.toString()) {
      return NextResponse.json({ success: false, message: 'Not authorized for this fleet' }, { status: 403 });
    }
  } else if (ensureActiveRole(user, 'buyer')) {
    query.buyer = user._id;
  } else {
    return NextResponse.json({ success: false, message: 'Buyer or transporter access required' }, { status: 403 });
  }

  const bids = await FleetBid.find(query)
    .populate('buyer', '_id name email phone')
    .populate('fleet', '_id plateNumber fleetName fleetNumber model price')
    .sort({ createdAt: -1 });

  return NextResponse.json({ success: true, data: bids }, { status: 200 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Buyer access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet id' }, { status: 400 });
  }

  const fleet = await Truck.findById(id).select('_id transporter plateNumber fleetName fleetNumber model price');
  if (!fleet) {
    return NextResponse.json({ success: false, message: 'Fleet not found' }, { status: 404 });
  }

  const body: any = await request.json().catch(() => ({}));
  const amount = body?.amount ?? body?.proposedPrice;
  if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ success: false, message: 'Valid amount is required' }, { status: 400 });
  }

  const bid = await FleetBid.create({
    fleet: fleet._id,
    transporter: fleet.transporter,
    buyer: user._id,
    amount,
    message: typeof body?.message === 'string' ? body.message : null
  });

  await bid.populate('buyer', '_id name email phone');
  await bid.populate('fleet', '_id plateNumber fleetName fleetNumber model price');

  return NextResponse.json({ success: true, data: bid }, { status: 201 });
}
