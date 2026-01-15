import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import SupportTicket from '@/models/supportTicket';
import { getAuthUser } from '@/lib/apiAuth';
import mongoose from 'mongoose';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid transaction id' }, { status: 400 });
  }

  const tx = await Transaction.findById(id);
  if (!tx) {
    return NextResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 });
  }

  const body: any = await request.json().catch(() => ({}));
  const message = body?.message || 'Please assist with this transaction.';
  const subject = body?.subject || `Support for transaction ${tx._id.toString()}`;

  const ticket = await SupportTicket.create({
    user: user._id,
    subject,
    message,
    linkedTransaction: tx._id,
    linkedOrder: tx.order || null,
    status: 'open',
    priority: 'medium',
  });

  return NextResponse.json({ success: true, data: ticket, message: 'Support request created' }, { status: 201 });
}
