import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import Order from '@/models/order';
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
  if (!['cash', 'bank_transfer', 'card'].includes(paymentMethod)) {
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
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ error: 'Buyer access required' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    Transaction.find({ buyer: user._id }).populate('order').skip(skip).limit(limit),
    Transaction.countDocuments({ buyer: user._id })
  ]);

  return NextResponse.json({
    success: true,
    data: transactions,
    pagination: { page, limit, total }
  }, { status: 200 });
}
