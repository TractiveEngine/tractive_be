import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import FleetPayment from '@/models/fleetPayment';
import FleetBooking from '@/models/fleetBooking';
import { requireAdmin } from '@/lib/apiAdmin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet payment id' }, { status: 400 });
  }

  try {
    const payment = await FleetPayment.findById(id)
      .populate('buyer', 'name email phone businessName')
      .populate('transporter', 'name email phone businessName')
      .populate('fleet', '_id plateNumber fleetName fleetNumber model route status price')
      .populate('fleetBid', '_id amount counterAmount status')
      .populate({
        path: 'booking',
        model: FleetBooking,
        populate: [
          { path: 'buyer', select: 'name email phone businessName' },
          { path: 'transporter', select: 'name email phone businessName' },
          { path: 'fleet', select: '_id plateNumber fleetName fleetNumber model route status price' }
        ]
      })
      .populate('approvedBy', 'name email');

    if (!payment) {
      return NextResponse.json({ success: false, message: 'Fleet payment not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: payment
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching fleet payment:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
