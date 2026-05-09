import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Notification from '@/models/notification';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/notifications - List user's notifications
export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    
    // Query parameters
    const isRead = searchParams.get('isRead');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build query
    const query: any = { user: user._id };
    
    if (isRead !== null && isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    // Get notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      user: user._id, 
      isRead: false 
    });

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

// PATCH /api/notifications - Mark all notifications as read
export async function PATCH(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const isRead = body.isRead !== undefined ? body.isRead : true;

    // Update all user's notifications
    const result = await Notification.updateMany(
      { user: user._id, isRead: !isRead },
      { isRead: isRead }
    );

    return NextResponse.json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount
      },
      message: `${result.modifiedCount} notifications marked as ${isRead ? 'read' : 'unread'}`
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
