import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Conversation from '@/models/conversation';
import Message from '@/models/message';
import User from '@/models/user';
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
  if (!ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid customer id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const customer = await User.findById(id);
  if (!customer) {
    return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 });
  }

  let conversation = await Conversation.findOne({
    participants: { $all: [user._id, customer._id] }
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [user._id, customer._id],
      isClosed: false,
      lastMessageAt: new Date()
    });
  }

  const initialMessage = body?.message || body?.initialMessage || null;
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
      conversationId: conversation._id,
      subject: body?.subject || null
    }
  }, { status: 201 });
}
