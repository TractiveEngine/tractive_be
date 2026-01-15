import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import SupportTicket from '@/models/supportTicket';
import User from '@/models/user';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

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

// GET /api/help - List user's support tickets
export async function GET(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  try {
    const tickets = await SupportTicket.find({ user: userData.userId })
      .populate('linkedOrder')
      .populate('linkedTransaction')
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      data: tickets
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching support tickets:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST /api/help - Create support ticket
export async function POST(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  try {
    const { subject, message, priority, linkedOrderId, linkedTransactionId } = await request.json();

    // Validate required fields
    if (!subject || !message) {
      return NextResponse.json({ 
        success: false, 
        message: 'Subject and message are required' 
      }, { status: 400 });
    }

    // Validate priority if provided
    if (priority && !['low', 'medium', 'high'].includes(priority)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Priority must be: low, medium, or high' 
      }, { status: 400 });
    }

    // Validate ObjectIds if provided
    if (linkedOrderId && !mongoose.Types.ObjectId.isValid(linkedOrderId)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid order ID format' 
      }, { status: 400 });
    }

    if (linkedTransactionId && !mongoose.Types.ObjectId.isValid(linkedTransactionId)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid transaction ID format' 
      }, { status: 400 });
    }

    // Create ticket
    const ticket = await SupportTicket.create({
      user: userData.userId,
      subject,
      message,
      priority: priority || 'medium',
      linkedOrder: linkedOrderId || null,
      linkedTransaction: linkedTransactionId || null,
      status: 'open'
    });

    return NextResponse.json({
      success: true,
      data: ticket,
      message: 'Support ticket created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating support ticket:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE /api/help - Close ticket (soft delete)
export async function DELETE(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticketId');

    if (!ticketId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Ticket ID is required' 
      }, { status: 400 });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid ticket ID format' 
      }, { status: 400 });
    }

    // Find ticket
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return NextResponse.json({ 
        success: false, 
        message: 'Ticket not found' 
      }, { status: 404 });
    }

    // Verify ownership
    if (ticket.user.toString() !== userData.userId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Not authorized to close this ticket' 
      }, { status: 403 });
    }

    // Check if ticket can be closed
    if (ticket.status === 'resolved') {
      return NextResponse.json({ 
        success: false, 
        message: 'Resolved tickets cannot be closed by users' 
      }, { status: 400 });
    }

    // Close ticket
    ticket.status = 'closed';
    await ticket.save();

    return NextResponse.json({
      success: true,
      data: ticket,
      message: 'Ticket closed successfully'
    }, { status: 200 });

  } catch (error) {
    console.error('Error closing ticket:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
