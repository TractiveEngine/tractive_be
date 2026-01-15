import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Conversation from '@/models/conversation';
import Message from '@/models/message';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

async function ensureAccess(userId: string, conversationId: string) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return { error: NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 }) };
  }
  const isParticipant = conversation.participants.some((p: any) => p.toString() === userId);
  return { conversation, isParticipant };
}

// PATCH /api/chat/:conversationId/messages/:messageId
export async function PATCH(
  request: Request,
  { params }: { params: { conversationId: string; messageId: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { conversationId, messageId } = params;
  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    return NextResponse.json({ success: false, message: 'Invalid conversation or message id' }, { status: 400 });
  }

  const { conversation, isParticipant, error } = await ensureAccess(user._id.toString(), conversationId);
  if (error) return error;

  if (!isParticipant && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Not authorized to modify this message' }, { status: 403 });
  }

  const { text } = await request.json().catch(() => ({}));
  if (!text) {
    return NextResponse.json({ success: false, message: 'Message text is required' }, { status: 400 });
  }

  const message = await Message.findOne({ _id: messageId, conversation: conversationId });
  if (!message) {
    return NextResponse.json({ success: false, message: 'Message not found' }, { status: 404 });
  }

  message.text = text;
  await message.save();

  return NextResponse.json({ success: true, data: message, message: 'Message updated' }, { status: 200 });
}

// DELETE /api/chat/:conversationId/messages/:messageId
export async function DELETE(
  request: Request,
  { params }: { params: { conversationId: string; messageId: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { conversationId, messageId } = params;
  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    return NextResponse.json({ success: false, message: 'Invalid conversation or message id' }, { status: 400 });
  }

  const { conversation, isParticipant, error } = await ensureAccess(user._id.toString(), conversationId);
  if (error) return error;

  if (!isParticipant && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Not authorized to delete this message' }, { status: 403 });
  }

  const message = await Message.findOne({ _id: messageId, conversation: conversationId });
  if (!message) {
    return NextResponse.json({ success: false, message: 'Message not found' }, { status: 404 });
  }

  await message.deleteOne();

  if (conversation.lastMessageAt && message.sentAt && message.sentAt >= conversation.lastMessageAt) {
    const last = await Message.findOne({ conversation: conversationId }).sort({ sentAt: -1 });
    conversation.lastMessageAt = last?.sentAt || conversation.createdAt || new Date();
    await conversation.save();
  }

  return NextResponse.json({ success: true, message: 'Message deleted' }, { status: 200 });
}
