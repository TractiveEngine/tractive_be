import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import FleetPayment from '@/models/fleetPayment';
import FleetBooking from '@/models/fleetBooking';
import { requireAdmin } from '@/lib/apiAdmin';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  try {
    const { fleetPaymentId, reason, refundAmount } = await request.json();

    if (!fleetPaymentId) {
      return NextResponse.json({ success: false, message: 'Fleet payment ID is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(fleetPaymentId)) {
      return NextResponse.json({ success: false, message: 'Invalid fleet payment ID format' }, { status: 400 });
    }

    const payment = await FleetPayment.findById(fleetPaymentId);
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
  } catch (error) {
    console.error('Error processing fleet refund:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
