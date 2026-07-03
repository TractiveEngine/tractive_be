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
  const messageText = typeof body?.message === 'string'
    ? body.message.trim()
    : typeof body?.initialMessage === 'string'
      ? body.initialMessage.trim()
      : '';
  if (!messageText) {
    return NextResponse.json({ success: false, message: 'message is required' }, { status: 400 });
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

  const createdMessage = await Message.create({
    conversation: conversation._id,
    sender: user._id,
    text: messageText,
    readBy: [user._id]
  });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  return NextResponse.json({
    success: true,
    data: {
      id: createdMessage._id,
      threadId: conversation._id,
      conversationId: conversation._id,
      customerId: customer._id,
      subject: typeof body?.subject === 'string' ? body.subject.trim() || null : null,
      message: createdMessage.text,
      createdAt: createdMessage.createdAt,
      status: conversation.isClosed ? 'closed' : 'open'
    }
  }, { status: 201 });
}
