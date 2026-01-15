import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Notification from '@/models/notification';
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

// PATCH /api/notifications/[id] - Mark single notification as read/unread
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid notification ID format' 
      }, { status: 400 });
    }

    const { isRead } = await request.json();

    // Validate isRead
    if (typeof isRead !== 'boolean') {
      return NextResponse.json({ 
        success: false, 
        message: 'isRead must be a boolean' 
      }, { status: 400 });
    }

    // Find notification
    const notification = await Notification.findOne({
      _id: id,
      user: userData.userId
    });

    if (!notification) {
      return NextResponse.json({ 
        success: false, 
        message: 'Notification not found' 
      }, { status: 404 });
    }

    // Update notification
    notification.isRead = isRead;
    await notification.save();

    return NextResponse.json({
      success: true,
      data: notification,
      message: `Notification marked as ${isRead ? 'read' : 'unread'}`
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE /api/notifications/[id] - Delete single notification
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid notification ID format' 
      }, { status: 400 });
    }

    // Delete notification (only if it belongs to the user)
    const result = await Notification.deleteOne({
      _id: id,
      user: userData.userId
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Notification not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully'
    }, { status: 200 });

  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
