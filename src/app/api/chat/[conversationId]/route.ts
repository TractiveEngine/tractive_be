import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Conversation from '@/models/conversation';
import Message from '@/models/message';
import User from '@/models/user';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createNotification } from '@/lib/notifications';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

type JwtUserPayload = {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

function isJwtUserPayload(p: unknown): p is JwtUserPayload {
  return typeof p === 'object' && p !== null && 'userId' in p && typeof (p as JwtUserPayload).userId === 'string';
}

function getUserFromRequest(request: Request): JwtUserPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string' || !isJwtUserPayload(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// GET /api/chat/[conversationId] - Get messages for conversation
export async function GET(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  try {
    const { conversationId } = params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid conversation ID format' 
      }, { status: 400 });
    }

    // Find conversation
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'name email businessName roles');

    if (!conversation) {
      return NextResponse.json({ 
        success: false, 
        message: 'Conversation not found' 
      }, { status: 404 });
    }

    // Check if user is a participant
    const isParticipant = conversation.participants.some(
      (p: any) => p._id.toString() === userData.userId
    );

    if (!isParticipant) {
      return NextResponse.json({ 
        success: false, 
        message: 'Not authorized to view this conversation' 
      }, { status: 403 });
    }

    // Get messages
    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'name email businessName roles')
      .sort({ sentAt: 1 });

    // Mark messages as read by current user
    await Message.updateMany(
      {
        conversation: conversationId,
        readBy: { $ne: userData.userId }
      },
      {
        $addToSet: { readBy: userData.userId }
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        conversation,
        messages
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST /api/chat/[conversationId] - Send message to conversation
export async function POST(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  try {
    const { conversationId } = params;
    const { text } = await request.json();

    // Validate required fields
    if (!text) {
      return NextResponse.json({ 
        success: false, 
        message: 'Message text is required' 
      }, { status: 400 });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid conversation ID format' 
      }, { status: 400 });
    }

    // Find conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return NextResponse.json({ 
        success: false, 
        message: 'Conversation not found' 
      }, { status: 404 });
    }

    // Check if user is a participant
    const isParticipant = conversation.participants.some(
      (p: any) => p.toString() === userData.userId
    );

    if (!isParticipant) {
      return NextResponse.json({ 
        success: false, 
        message: 'Not authorized to send messages in this conversation' 
      }, { status: 403 });
    }

    // Check if conversation is closed
    if (conversation.isClosed) {
      return NextResponse.json({ 
        success: false, 
        message: 'Cannot send messages to a closed conversation' 
      }, { status: 400 });
    }

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: userData.userId,
      text,
      readBy: [userData.userId]
    });

    // Update conversation last message time
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Populate sender info
    await message.populate('sender', 'name email businessName roles');

    // Notify other participants about new message
    const otherParticipants = conversation.participants.filter(
      (p: any) => p.toString() !== userData.userId
    );

    for (const participantId of otherParticipants) {
      await createNotification({
        userId: participantId.toString(),
        type: 'chat_message',
        title: 'New chat message',
        message: `You have a new message: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
        metadata: {
          conversationId: conversationId,
          messageId: message._id.toString(),
          senderId: userData.userId
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: message,
      message: 'Message sent successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
