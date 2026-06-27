import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Notification from '@/models/notification';
import { getAuthUser } from '@/lib/apiAuth';
import mongoose from 'mongoose';

// PATCH /api/notifications/[id] - Mark single notification as read/unread
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
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
      user: user._id
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

  const user = await getAuthUser(request);
  if (!user) {
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
      user: user._id
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
