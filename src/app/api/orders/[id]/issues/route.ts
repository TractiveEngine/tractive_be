import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import SupportTicket from '@/models/supportTicket';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

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

  const order = await Order.findById(id);
  if (!order || order.buyer?.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  const body: any = await request.json().catch(() => ({}));
  if (!body?.description) {
    return NextResponse.json({ success: false, message: 'description is required' }, { status: 400 });
  }

  const ticket = await SupportTicket.create({
    user: user._id,
    subject: body?.category ? `Order issue: ${body.category}` : `Order issue: ${order._id.toString()}`,
    message: body.description,
    category: body.category || null,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    linkedOrder: order._id,
    status: 'open',
    priority: 'medium'
  });

  return NextResponse.json({ success: true, data: ticket, message: 'Issue reported successfully' }, { status: 201 });
}
