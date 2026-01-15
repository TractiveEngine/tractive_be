import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import User from '@/models/user';
import jwt from 'jsonwebtoken';
import { createNotification } from '@/lib/notifications';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

type JwtUserPayload = {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

function isJwtUserPayload(p: unknown): p is JwtUserPayload {
  return typeof p === 'object' && p !== null && 'userId' in p && typeof (p as JwtUserPayload).userId === 'string';
}

function getUserFromRequest(request: Request): JwtUserPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string' || !isJwtUserPayload(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const transaction = await Transaction.findById(id).populate('order');
  if (!transaction || String(transaction.buyer) !== userData.userId) {
    return NextResponse.json({ error: 'Transaction not found or access denied' }, { status: 404 });
  }
  return NextResponse.json({ transaction }, { status: 200 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('admin')) {
    return NextResponse.json({ error: 'Only admin can approve transactions' }, { status: 403 });
  }

  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  const body = await request.json();
  if (body.status && body.status === 'approved') {
    transaction.status = 'approved';
    transaction.approvedBy = user._id;
    transaction.updatedAt = new Date();
    await transaction.save();

    // Notify buyer about transaction approval
    await createNotification({
      userId: transaction.buyer.toString(),
      type: 'transaction_approved',
      title: 'Transaction approved',
      message: `Your transaction of ${transaction.amount} has been approved`,
      metadata: {
        transactionId: transaction._id.toString(),
        amount: transaction.amount,
        orderId: transaction.order?.toString()
      }
    });

    return NextResponse.json({ transaction }, { status: 200 });
  }

  if (body.status && body.status === 'declined') {
    transaction.status = 'pending'; // or add 'declined' to enum
    transaction.updatedAt = new Date();
    await transaction.save();

    // Notify buyer about transaction decline
    await createNotification({
      userId: transaction.buyer.toString(),
      type: 'transaction_declined',
      title: 'Transaction declined',
      message: `Your transaction of ${transaction.amount} was declined`,
      metadata: {
        transactionId: transaction._id.toString(),
        amount: transaction.amount
      }
    });

    return NextResponse.json({ transaction }, { status: 200 });
  }

  return NextResponse.json({ error: 'Invalid status or not allowed' }, { status: 400 });
}
