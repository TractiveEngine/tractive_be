import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Order from '@/models/order';
import User from '@/models/user';
import dbConnect from '@/lib/dbConnect';
import { requireAdmin } from '@/lib/apiAdmin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> | { orderId: string } }
) {
  await dbConnect();
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { orderId } = await Promise.resolve(params);
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const order = await Order.findById(orderId).select('buyer');
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  const buyer = await User.findById(order.buyer).select('_id name businessName email phone image state address');
  return NextResponse.json({ success: true, data: buyer }, { status: 200 });
}
