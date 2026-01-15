import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import TrackingEvent from '@/models/trackingEvent';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

export async function GET(request: Request, { params }: { params: { orderId: string } }) {
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

  const timeline = await TrackingEvent.find({ order: order._id }).sort({ createdAt: 1 }).lean();

  return NextResponse.json(
    {
      success: true,
      data: {
        orderId: order._id.toString(),
        transportStatus: order.transportStatus,
        timeline: timeline.map((t) => ({
          status: t.status,
          timestamp: t.createdAt,
          note: t.note,
          location: t.location,
        })),
      },
    },
    { status: 200 }
  );
}
