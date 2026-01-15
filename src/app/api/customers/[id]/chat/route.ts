import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Conversation from '@/models/conversation';
import Message from '@/models/message';
import User from '@/models/user';
import { getAuthUser } from '@/lib/apiAuth';
import mongoose from 'mongoose';

// POST /api/customers/:id/chat - open or create chat with customer
export async function POST(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid customer id' }, { status: 400 });
  }

  const customer = await User.findById(id);
  if (!customer) {
    return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 });
  }

  const existing = await Conversation.findOne({
    participants: { $all: [user._id, customer._id] }
  });

  if (existing) {
    return NextResponse.json({ success: true, data: { conversationId: existing._id } }, { status: 200 });
  }

  const conversation = await Conversation.create({
    participants: [user._id, customer._id],
    isClosed: false,
    lastMessageAt: new Date(),
  });

  const body: any = await request.json().catch(() => ({}));
  if (body?.initialMessage) {
    await Message.create({
      conversation: conversation._id,
      sender: user._id,
      text: body.initialMessage,
      readBy: [user._id],
    });
  }

  return NextResponse.json({ success: true, data: { conversationId: conversation._id } }, { status: 201 });
}
