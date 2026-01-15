import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import Order from '@/models/order';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

const ALLOWED = ['approved', 'pending'] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid transaction id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const status = body?.status;
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
  }

  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return NextResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 });
  }

  const order = await Order.findById(transaction.order);
  if (!order || order.transporter?.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized for this transaction' }, { status: 403 });
  }

  transaction.status = status as any;
  transaction.updatedAt = new Date();
  await transaction.save();

  return NextResponse.json({ success: true, data: transaction }, { status: 200 });
}
