import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Conversation from '@/models/conversation';
import Message from '@/models/message';
import User from '@/models/user';
import jwt from 'jsonwebtoken';

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

// GET /api/chat - List user's conversations
export async function GET(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  try {
    // Find conversations where user is a participant
    const conversations = await Conversation.find({
      participants: userData.userId
    })
      .populate('participants', 'name email businessName roles')
      .sort({ lastMessageAt: -1 });

    // Get last message for each conversation
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
          lastMessage: lastMessage ? {
            text: lastMessage.text,
            sender: lastMessage.sender,
            sentAt: lastMessage.sentAt
          } : null,
          createdAt: conv.createdAt
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: conversationsWithLastMessage
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST /api/chat - Create new conversation
export async function POST(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  try {
    const { initialMessage } = await request.json();

    // Validate required fields
    if (!initialMessage) {
      return NextResponse.json({ 
        success: false, 
        message: 'Initial message is required' 
      }, { status: 400 });
    }

    // Check if user already has an open conversation
    const existingConversation = await Conversation.findOne({
      participants: userData.userId,
      isClosed: false
    });

    if (existingConversation) {
      // Add message to existing conversation
      const message = await Message.create({
        conversation: existingConversation._id,
        sender: userData.userId,
        text: initialMessage,
        readBy: [userData.userId]
      });

      existingConversation.lastMessageAt = new Date();
      await existingConversation.save();

      return NextResponse.json({
        success: true,
        data: {
          conversation: existingConversation,
          message
        },
        message: 'Message added to existing conversation'
      }, { status: 200 });
    }

    // Create new conversation
    const conversation = await Conversation.create({
      participants: [userData.userId],
      isClosed: false,
      lastMessageAt: new Date()
    });

    // Create first message
    const message = await Message.create({
      conversation: conversation._id,
      sender: userData.userId,
      text: initialMessage,
      readBy: [userData.userId]
    });

    return NextResponse.json({
      success: true,
      data: {
        conversation,
        message
      },
      message: 'Conversation created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
