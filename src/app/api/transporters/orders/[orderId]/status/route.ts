import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import TrackingEvent from '@/models/trackingEvent';
import mongoose from 'mongoose';

const TRANSPORT_STATUS = ['pending', 'picked', 'on_transit', 'delivered'] as const;

export async function PATCH(request: Request, { params }: { params: { orderId: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { orderId } = params;
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const order = await Order.findById(orderId);
  if (!order || order.transporter?.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Order not found or not assigned to you' }, { status: 404 });
  }

  const body: any = await request.json().catch(() => ({}));
  const transportStatus = body?.transportStatus;
  if (!TRANSPORT_STATUS.includes(transportStatus)) {
    return NextResponse.json({ success: false, message: 'Invalid transport status' }, { status: 400 });
  }

  order.transportStatus = transportStatus;
  order.updatedAt = new Date();
  await order.save();

  await TrackingEvent.create({
    order: order._id,
    status: transportStatus,
    note: body?.note || '',
    location: body?.location || '',
  });

  return NextResponse.json({ success: true, data: order }, { status: 200 });
}
