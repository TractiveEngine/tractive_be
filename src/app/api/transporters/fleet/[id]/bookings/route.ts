import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import Truck from '@/models/truck';
import FleetBooking from '@/models/fleetBooking';

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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const query: Record<string, unknown> = { fleet: fleet._id };
  if (status && ['pending_payment', 'confirmed', 'rejected', 'cancelled', 'completed'].includes(status)) {
    query.status = status;
  }

  if (ensureActiveRole(user, 'buyer')) {
    query.buyer = user._id;
  } else if (ensureActiveRole(user, 'transporter')) {
    if (fleet.transporter?.toString() !== user._id.toString()) {
      return NextResponse.json({ success: false, message: 'Not authorized for this fleet' }, { status: 403 });
    }
  } else if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json(
      { success: false, message: 'Buyer, transporter, or admin access required' },
      { status: 403 }
    );
  }

  const bookings = await FleetBooking.find(query)
    .populate('fleet', '_id plateNumber fleetName fleetNumber model price status route')
    .populate('buyer', '_id name email phone')
    .populate('transporter', '_id name email phone businessName')
    .populate('fleetBid', '_id amount counterAmount status')
    .populate('payment', '_id amount paymentMethod status')
    .sort({ createdAt: -1 });

  return NextResponse.json({ success: true, data: bookings }, { status: 200 });
}
