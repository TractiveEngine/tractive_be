import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Conversation from '@/models/conversation';
import Message from '@/models/message';
import { requireAdmin } from '@/lib/apiAdmin';

export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const conversations = await Conversation.find()
    .populate('participants', 'name email roles')
    .sort({ lastMessageAt: -1 });

  const conversationsWithLastMessage = await Promise.all(
    conversations.map(async (conv) => {
      const lastMessage = await Message.findOne({ conversation: conv._id })
        .sort({ sentAt: -1 })
        .populate('sender', 'name email');
      return {
        _id: conv._id,
        participants: conv.participants,
        isClosed: conv.isClosed,
        lastMessageAt: conv.lastMessageAt,
        lastMessage: lastMessage
          ? { text: lastMessage.text, sender: lastMessage.sender, sentAt: lastMessage.sentAt }
          : null,
        createdAt: conv.createdAt,
      };
    })
  );

  return NextResponse.json({ success: true, data: conversationsWithLastMessage }, { status: 200 });
}
