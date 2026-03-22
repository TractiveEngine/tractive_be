import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import Truck from '@/models/truck';
import FleetBid from '@/models/fleetBid';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; bidId: string }> | { id: string; bidId: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Buyer access required' }, { status: 403 });
  }

  const { id, bidId } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet id' }, { status: 400 });
  }
  if (!bidId || !mongoose.Types.ObjectId.isValid(bidId)) {
    return NextResponse.json({ success: false, message: 'Invalid bid id' }, { status: 400 });
  }

  const fleet = await Truck.findById(id).select('_id');
  if (!fleet) {
    return NextResponse.json({ success: false, message: 'Fleet not found' }, { status: 404 });
  }

  const bid = await FleetBid.findOne({ _id: bidId, fleet: fleet._id, buyer: user._id });
  if (!bid) {
    return NextResponse.json({ success: false, message: 'Fleet bid not found' }, { status: 404 });
  }
  if (bid.status !== 'countered') {
    return NextResponse.json({ success: false, message: 'Only countered bids can be responded to by buyer' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const action = body?.action;
  if (!['accept', 'reject'].includes(action)) {
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  }

  bid.status = action === 'accept' ? 'accepted' : 'rejected';
  if (typeof body?.message === 'string') {
    bid.responseMessage = body.message;
  }
  bid.updatedAt = new Date();
  await bid.save();
  await bid.populate('buyer', '_id name email phone');
  await bid.populate('fleet', '_id plateNumber fleetName fleetNumber model price');

  return NextResponse.json({ success: true, data: bid }, { status: 200 });
}
