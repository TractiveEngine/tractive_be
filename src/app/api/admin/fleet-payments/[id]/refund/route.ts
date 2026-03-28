import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import FleetPayment from '@/models/fleetPayment';
import FleetBooking from '@/models/fleetBooking';
import { requireAdmin } from '@/lib/apiAdmin';
import mongoose from 'mongoose';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet payment ID' }, { status: 400 });
  }

  const { reason, refundAmount } = await request.json().catch(() => ({}));

  const payment = await FleetPayment.findById(id);
  if (!payment) {
    return NextResponse.json({ success: false, message: 'Fleet payment not found' }, { status: 404 });
  }
  if (payment.status !== 'approved') {
    return NextResponse.json({ success: false, message: 'Only approved fleet payments can be refunded' }, { status: 400 });
  }

  payment.status = 'refunded';
  payment.refundReason = reason || null;
  payment.updatedAt = new Date();
  await payment.save();

  if (payment.booking) {
    const booking = await FleetBooking.findById(payment.booking);
    if (booking) {
      booking.status = 'cancelled';
      booking.updatedAt = new Date();
      await booking.save();
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      _id: payment._id,
      amount: payment.amount,
      status: payment.status,
      refundReason: reason,
      refundAmount: refundAmount ?? payment.amount
    },
    message: 'Fleet payment refunded successfully'
  }, { status: 200 });
}
