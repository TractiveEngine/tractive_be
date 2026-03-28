import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import TrackingEvent from '@/models/trackingEvent';
import mongoose from 'mongoose';

const TRANSPORT_STATUS = ['pending', 'picked', 'on_transit', 'delivered'] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> | { orderId: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { orderId } = await Promise.resolve(params);
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const existingOrder = await Order.findById(orderId).populate('products.product');
  if (!existingOrder) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  const isTransporter =
    ensureActiveRole(user, 'transporter') && existingOrder.transporter?.toString() === user._id.toString();
  const sellerIds = (existingOrder.products || [])
    .map((p: any) => p?.product?.owner?.toString?.())
    .filter(Boolean);
  const isSeller = ensureActiveRole(user, 'agent') && sellerIds.includes(user._id.toString());

  if (!isTransporter && !isSeller) {
    return NextResponse.json(
      { success: false, message: 'Transporter or seller access required for this order' },
      { status: 403 }
    );
  }

  const body: any = await request.json().catch(() => ({}));
  const transportStatus = body?.transportStatus;
  if (!TRANSPORT_STATUS.includes(transportStatus)) {
    return NextResponse.json({ success: false, message: 'Invalid transport status' }, { status: 400 });
  }

  const order = await Order.findOneAndUpdate(
    { _id: orderId },
    { $set: { transportStatus, updatedAt: new Date() } },
    { new: true }
  );
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  await TrackingEvent.create({
    order: order._id,
    status: transportStatus,
    note: body?.note || '',
    location: body?.location || '',
  });

  return NextResponse.json({ success: true, data: order }, { status: 200 });
}
