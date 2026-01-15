import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import { requireAdmin } from '@/lib/apiAdmin';
import mongoose from 'mongoose';
import { createNotification } from '@/lib/notifications';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid transaction ID' }, { status: 400 });
  }

  const { reason, refundAmount } = await request.json().catch(() => ({}));

  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return NextResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 });
  }

  if (transaction.status !== 'approved') {
    return NextResponse.json({ success: false, message: 'Only approved transactions can be refunded' }, { status: 400 });
  }

  transaction.status = 'refunded' as any;
  transaction.updatedAt = new Date();
  await transaction.save();

  await createNotification({
    userId: transaction.buyer.toString(),
    type: 'transaction_refunded',
    title: 'Transaction refunded',
    message: `Your transaction of ${refundAmount ?? transaction.amount} has been refunded`,
    metadata: {
      transactionId: transaction._id.toString(),
      amount: refundAmount ?? transaction.amount,
      reason: reason || 'No reason provided'
    }
  });

  return NextResponse.json({
    success: true,
    data: {
      _id: transaction._id,
      amount: transaction.amount,
      status: transaction.status,
      refundReason: reason,
      refundAmount: refundAmount ?? transaction.amount
    },
    message: 'Transaction refunded successfully'
  }, { status: 200 });
}
