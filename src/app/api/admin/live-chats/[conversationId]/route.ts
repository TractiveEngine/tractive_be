import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Conversation from '@/models/conversation';
import Message from '@/models/message';
import { requireAdmin } from '@/lib/apiAdmin';
import mongoose from 'mongoose';

export async function GET(request: Request, { params }: { params: { conversationId: string } }) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { conversationId } = params;
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    return NextResponse.json({ success: false, message: 'Invalid conversation id' }, { status: 400 });
  }

  const conversation = await Conversation.findById(conversationId).populate('participants', 'name email roles');
  if (!conversation) {
    return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
  }

  const messages = await Message.find({ conversation: conversationId }).sort({ sentAt: 1 }).populate('sender', 'name email');

  return NextResponse.json({ success: true, data: { conversation, messages } }, { status: 200 });
}

export async function DELETE(request: Request, { params }: { params: { conversationId: string } }) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { conversationId } = params;
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    return NextResponse.json({ success: false, message: 'Invalid conversation id' }, { status: 400 });
  }

  const deleted = await Conversation.findByIdAndDelete(conversationId);
  if (!deleted) {
    return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
  }
  await Message.deleteMany({ conversation: conversationId });

  return NextResponse.json({ success: true, message: 'Conversation deleted' }, { status: 200 });
}
