import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import { createNotification } from '@/lib/notifications';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Buyer access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const order = await Order.findById(id).populate('products.product');
  if (!order || order.buyer?.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  order.transportStatus = 'delivered';
  order.status = 'delivered';
  order.updatedAt = new Date();
  await order.save();

  if (order.transporter) {
    await createNotification({
      userId: order.transporter.toString(),
      type: 'order_status_changed',
      title: 'Buyer confirmed receipt',
      message: `Buyer confirmed receipt for order ${order._id.toString()}`,
      metadata: { orderId: order._id.toString(), confirmedByBuyer: true }
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      orderId: order._id.toString(),
      status: order.status,
      transportStatus: order.transportStatus
    },
    message: 'Receipt confirmed successfully'
  }, { status: 200 });
}
