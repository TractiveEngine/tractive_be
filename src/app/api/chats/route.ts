import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Conversation from '@/models/conversation';
import Message from '@/models/message';
import Order from '@/models/order';
import User from '@/models/user';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const body: any = await request.json().catch(() => ({}));
  const orderId = body?.orderId;
  const sellerId = body?.sellerId;
  const initialMessage = body?.initialMessage || '';

  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return NextResponse.json({ success: false, message: 'Valid orderId is required' }, { status: 400 });
  }
  if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
    return NextResponse.json({ success: false, message: 'Valid sellerId is required' }, { status: 400 });
  }

  const order = await Order.findById(orderId).populate({
    path: 'products.product',
    select: 'owner'
  });
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  const userId = user._id.toString();
  const isBuyer = ensureActiveRole(user, 'buyer') && order.buyer?.toString() === userId;
  const sellerIds = (order.products || []).map((item: any) => item?.product?.owner?.toString?.()).filter(Boolean);
  const isSeller = sellerIds.includes(String(sellerId)) && userId === String(sellerId);
  if (!isBuyer && !isSeller && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Not authorized for this order chat' }, { status: 403 });
  }

  const seller = await User.findById(sellerId).select('_id');
  if (!seller) {
    return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
  }

  let conversation = await Conversation.findOne({
    order: order._id,
    participants: { $all: [order.buyer, seller._id] }
  });
  let created = false;

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [order.buyer, seller._id],
      order: order._id,
      isClosed: false,
      lastMessageAt: new Date()
    });
    created = true;
  }

  if (initialMessage) {
    await Message.create({
      conversation: conversation._id,
      sender: user._id,
      text: initialMessage,
      readBy: [user._id]
    });
    conversation.lastMessageAt = new Date();
    await conversation.save();
  }

  return NextResponse.json({
    success: true,
    data: {
      threadId: conversation._id.toString(),
      conversationId: conversation._id.toString(),
      orderId: order._id.toString()
    }
  }, { status: created ? 201 : 200 });
}
