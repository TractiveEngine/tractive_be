import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ paymentRef: string }> | { paymentRef: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Buyer access required' }, { status: 403 });
  }

  const { paymentRef } = await Promise.resolve(params);
  const body: any = await request.json().catch(() => ({}));

  const transaction = await Transaction.findOne({
    paymentReference: paymentRef,
    buyer: user._id
  });
  if (!transaction) {
    return NextResponse.json({ success: false, message: 'Payment not found' }, { status: 404 });
  }

  transaction.paymentConfirmation = {
    bankUsed: body?.bankUsed || null,
    narration: body?.narration || null,
    screenshotUrl: body?.screenshotUrl || null
  };
  transaction.paymentConfirmedAt = new Date();
  transaction.updatedAt = new Date();
  await transaction.save();

  return NextResponse.json({
    success: true,
    data: {
      _id: transaction._id,
      paymentReference: transaction.paymentReference,
      paymentConfirmedAt: transaction.paymentConfirmedAt,
      paymentConfirmation: transaction.paymentConfirmation,
      status: transaction.status
    }
  }, { status: 200 });
}

