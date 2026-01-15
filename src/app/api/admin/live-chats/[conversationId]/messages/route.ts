import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Conversation from '@/models/conversation';
import Message from '@/models/message';
import { requireAdmin } from '@/lib/apiAdmin';
import mongoose from 'mongoose';

export async function POST(request: Request, { params }: { params: { conversationId: string } }) {
  const { error, user } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { conversationId } = params;
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    return NextResponse.json({ success: false, message: 'Invalid conversation id' }, { status: 400 });
  }

  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
  }

  const body: any = await request.json().catch(() => ({}));
  const text = body?.text;
  if (!text) {
    return NextResponse.json({ success: false, message: 'Message text required' }, { status: 400 });
  }

  // ensure admin in participants for audit
  if (!conv.participants.map((p) => p.toString()).includes(user._id.toString())) {
    conv.participants.push(user._id);
  }
  conv.lastMessageAt = new Date();
  await conv.save();

  const msg = await Message.create({
    conversation: conv._id,
    sender: user._id,
    text,
    readBy: [user._id],
  });

  return NextResponse.json({ success: true, data: msg }, { status: 201 });
}
