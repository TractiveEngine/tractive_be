import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import User from '@/models/user';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

function buyerDto(u: any) {
  if (!u) return null;
  return {
    id: u._id?.toString(),
    name: u.name || u.businessName || '',
    email: u.email,
    phone: u.phone,
  };
}

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

  const buyer = await User.findById(order.buyer);
  return NextResponse.json({ success: true, data: buyerDto(buyer) }, { status: 200 });
}
