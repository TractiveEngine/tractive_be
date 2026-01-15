import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Conversation from '@/models/conversation';
import { requireAdmin } from '@/lib/apiAdmin';
import mongoose from 'mongoose';

export async function PATCH(request: Request, { params }: { params: { conversationId: string } }) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { conversationId } = params;
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    return NextResponse.json({ success: false, message: 'Invalid conversation id' }, { status: 400 });
  }

  const conv = await Conversation.findByIdAndUpdate(
    conversationId,
    { isClosed: true, updatedAt: new Date() },
    { new: true }
  );
  if (!conv) {
    return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: conv }, { status: 200 });
}
