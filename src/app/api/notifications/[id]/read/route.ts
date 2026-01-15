import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Notification from '@/models/notification';
import { getAuthUser } from '@/lib/apiAuth';
import mongoose from 'mongoose';

// PATCH /api/notifications/:id/read
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid notification id' }, { status: 400 });
  }

  const notification = await Notification.findOne({ _id: id, user: user._id });
  if (!notification) {
    return NextResponse.json({ success: false, message: 'Notification not found' }, { status: 404 });
  }

  notification.isRead = true;
  await notification.save();

  return NextResponse.json({
    success: true,
    data: notification,
    message: 'Notification marked as read'
  }, { status: 200 });
}
