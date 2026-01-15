import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import User from '@/models/user';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
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

// POST /api/admin/transactions/refund - Process refund
export async function POST(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const adminUser = await User.findById(userData.userId);
  if (!adminUser || !adminUser.roles.includes('admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  try {
    const { transactionId, reason } = await request.json();

    // Validate required fields
    if (!transactionId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Transaction ID is required' 
      }, { status: 400 });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid transaction ID format' 
      }, { status: 400 });
    }

    // Find transaction
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return NextResponse.json({ 
        success: false, 
        message: 'Transaction not found' 
      }, { status: 404 });
    }

    // Check if transaction can be refunded
    if (transaction.status !== 'approved') {
      return NextResponse.json({ 
        success: false, 
        message: 'Only approved transactions can be refunded' 
      }, { status: 400 });
    }

    // Update transaction status to refunded
    // Note: In production, this would integrate with payment gateway
    transaction.status = 'refunded' as any; // Type assertion since 'refunded' isn't in the enum yet
    
    // Store refund reason (would need to add this field to Transaction model)
    // For now, we'll just update the status
    await transaction.save();

    // Notify buyer about refund
    await createNotification({
      userId: transaction.buyer.toString(),
      type: 'transaction_refunded',
      title: 'Transaction refunded',
      message: `Your transaction of ${transaction.amount} has been refunded`,
      metadata: {
        transactionId: transaction._id.toString(),
        amount: transaction.amount,
        reason: reason || 'No reason provided'
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        _id: transaction._id,
        amount: transaction.amount,
        status: transaction.status,
        refundReason: reason
      },
      message: 'Transaction refunded successfully'
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing refund:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
