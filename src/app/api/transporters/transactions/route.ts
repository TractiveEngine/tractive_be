import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import Order from '@/models/order';
import User from '@/models/user';
import jwt from 'jsonwebtoken';

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

// GET /api/transporters/transactions - Get transporter's transactions
export async function GET(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('transporter')) {
    return NextResponse.json({ error: 'Only transporters can view transactions' }, { status: 403 });
  }

  try {
    // Get all orders assigned to this transporter
    const orders = await Order.find({ transporter: user._id });
    const orderIds = orders.map(order => order._id);

    // Get transactions for these orders
    // Note: Current Transaction model doesn't have payeeId field
    // We're getting transactions based on orders assigned to transporter
    const transactions = await Transaction.find({
      order: { $in: orderIds }
    })
      .populate('buyer', 'name email businessName phone')
      .populate('order')
      .sort({ createdAt: -1 });

    // Format response with additional details
    const formattedTransactions = transactions.map(transaction => ({
      _id: transaction._id,
      buyer: {
        id: transaction.buyer._id,
        name: transaction.buyer.name || transaction.buyer.businessName || 'Unknown',
        email: transaction.buyer.email,
        phone: transaction.buyer.phone
      },
      order: {
        id: transaction.order._id,
        totalAmount: transaction.order.totalAmount,
        status: transaction.order.status,
        transportStatus: transaction.order.transportStatus
      },
      amount: transaction.amount,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      approvedBy: transaction.approvedBy,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    }));

    return NextResponse.json({ 
      success: true, 
      data: formattedTransactions 
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching transporter transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
