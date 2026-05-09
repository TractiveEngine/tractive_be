import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import Order from '@/models/order';
import Product from '@/models/product';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ error: 'Buyer access required' }, { status: 403 });
  }

  const { order: orderId, amount, paymentMethod } = await request.json();
  if (!orderId || !amount) {
    return NextResponse.json({ error: 'Order and amount required' }, { status: 400 });
  }
  if (!['cash', 'bank_transfer', 'card', 'wallet', 'deposit'].includes(paymentMethod)) {
    return NextResponse.json({ error: 'Valid paymentMethod is required' }, { status: 400 });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.buyer?.toString() !== user._id.toString()) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.status === 'paid' || order.status === 'delivered') {
    return NextResponse.json({ error: 'Order is already paid' }, { status: 400 });
  }
  if (Number(amount) !== Number(order.totalAmount)) {
    return NextResponse.json({ error: 'Amount must match the full order total' }, { status: 400 });
  }

  const existingTransaction = await Transaction.findOne({
    order: order._id,
    buyer: user._id,
    status: { $in: ['pending', 'approved'] }
  });
  if (existingTransaction) {
    return NextResponse.json({
      success: true,
      data: existingTransaction,
      message: 'Existing transaction returned'
    }, { status: 200 });
  }

  const transaction = await Transaction.create({
    order: order._id,
    buyer: user._id,
    amount,
    paymentMethod,
    status: 'pending'
  });

  order.status = 'payment_pending';
  order.updatedAt = new Date();
  await order.save();

  return NextResponse.json({ success: true, data: transaction }, { status: 201 });
}

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');
  const status = searchParams.get('status');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (status && ['pending', 'approved', 'rejected', 'refunded'].includes(status)) {
    query.status = status;
  }
  if (fromDate || toDate) {
    const createdAt: Record<string, Date> = {};
    if (fromDate) createdAt.$gte = new Date(fromDate);
    if (toDate) createdAt.$lte = new Date(toDate);
    query.createdAt = createdAt;
  }

  if (ensureActiveRole(user, 'buyer')) {
    query.buyer = user._id;
  } else if (ensureActiveRole(user, 'agent')) {
    const productIds = await Product.find({ owner: user._id }).distinct('_id');
    if (productIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0 }
      }, { status: 200 });
    }
    const orderIds = await Order.find({ 'products.product': { $in: productIds } }).distinct('_id');
    query.order = { $in: orderIds };
  } else {
    return NextResponse.json({ error: 'Buyer or agent access required' }, { status: 403 });
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate('buyer', 'name email businessName phone')
      .populate({
        path: 'order',
        populate: {
          path: 'products.product',
          model: Product,
          populate: {
            path: 'owner',
            select: 'name email businessName'
          }
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments(query)
  ]);

  return NextResponse.json({
    success: true,
    data: transactions,
    pagination: { page, limit, total }
  }, { status: 200 });
}
